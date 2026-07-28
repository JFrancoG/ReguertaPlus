import FirebaseAuth
import FirebaseMessaging
import Foundation
import OSLog
import UIKit

nonisolated struct AuthorizedDeviceSessionContext: Codable, Equatable, Sendable {
    let memberId: String
    let authUid: String
    let environment: SessionEnvironment
    let lease: AuthorizedDeviceSessionLease
}

actor FirebaseAuthorizedDeviceCoordinator: AuthorizedDeviceRegistrar {
    private static let logger = Logger(
        subsystem: "com.reguerta.app",
        category: "DeviceRegistration"
    )

    private let repository: any DeviceRegistrationRepository
    private let keychainStore: KeychainStore
    private let nowMillisProvider: @Sendable () -> Int64
    private let tokenProvider: @MainActor @Sendable () async throws -> String?
    private let currentAuthUidProvider: @MainActor @Sendable () -> String?
    private let deviceProvider: @MainActor @Sendable (String?, Int64) -> RegisteredDevice
    private let retryDelay: @Sendable () async throws -> Void
    private var activeContext: AuthorizedDeviceSessionContext?
    private var generation: UInt64 = 0

    init(
        repository: any DeviceRegistrationRepository,
        keychainStore: KeychainStore = KeychainStore(),
        nowMillisProvider: @escaping @Sendable () -> Int64 = {
            Int64(Date().timeIntervalSince1970 * 1_000)
        },
        tokenProvider: @escaping @MainActor @Sendable () async throws -> String? = {
            try await fetchFirebaseMessagingToken()
        },
        currentAuthUidProvider: @escaping @MainActor @Sendable () -> String? = {
            Auth.auth().currentUser?.uid
        },
        deviceProvider: @escaping @MainActor @Sendable (String?, Int64) -> RegisteredDevice = { token, nowMillis in
            makeCurrentIOSDevice(token: token, nowMillis: nowMillis)
        },
        retryDelay: @escaping @Sendable () async throws -> Void = {
            try await Task.sleep(for: .milliseconds(1_500))
        }
    ) {
        self.repository = repository
        self.keychainStore = keychainStore
        self.nowMillisProvider = nowMillisProvider
        self.tokenProvider = tokenProvider
        self.currentAuthUidProvider = currentAuthUidProvider
        self.deviceProvider = deviceProvider
        self.retryDelay = retryDelay
    }

    func register(
        command: AuthorizedDeviceRegistrationCommand,
        isSessionCurrent: @escaping @MainActor @Sendable () -> Bool
    ) async throws -> AuthorizedDeviceRegistrationResult {
        do {
            return try await performRegistration(
                command: command,
                isSessionCurrent: isSessionCurrent
            )
        } catch DeviceRegistrationRepositoryError.staleSession {
            return .skipped
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            Self.logger.error(
                "Authorized device registration failed: \(String(describing: error), privacy: .private)"
            )
            throw error
        }
    }

    func updateRegistrationToken(_ token: String?) async throws {
        do {
            try await performTokenUpdate(token)
        } catch DeviceRegistrationRepositoryError.staleSession {
            return
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            Self.logger.error(
                "Authorized device token update failed: \(String(describing: error), privacy: .private)"
            )
            throw error
        }
    }

    func clearAuthorization(ifOwnedBy lease: AuthorizedDeviceSessionLease) async throws {
        do {
            try await performAuthorizationClear(ifOwnedBy: lease)
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            Self.logger.error(
                "Authorized device context clear failed: \(String(describing: error), privacy: .private)"
            )
            throw error
        }
    }
}

private extension FirebaseAuthorizedDeviceCoordinator {
    private func performRegistration(
        command: AuthorizedDeviceRegistrationCommand,
        isSessionCurrent: @escaping @MainActor @Sendable () -> Bool
    ) async throws -> AuthorizedDeviceRegistrationResult {
        generation &+= 1
        let operationGeneration = generation
        let context = AuthorizedDeviceSessionContext(
            memberId: command.memberId,
            authUid: command.authUid,
            environment: command.environment,
            lease: command.lease
        )
        activeContext = context

        guard await isSessionCurrent() else {
            if activeContext == context {
                activeContext = nil
            }
            return .skipped
        }

        try await keychainStore.save(context, for: .authorizedDeviceContext)
        try await keychainStore.remove(.legacyAuthorizedMemberId)

        guard try await isCurrentOrDiscardContext(
            context,
            generation: operationGeneration,
            sessionFence: isSessionCurrent
        ) else {
            return .skipped
        }

        let token = try await fetchTokenWithRetry()
        guard try await isCurrentOrDiscardContext(
            context,
            generation: operationGeneration,
            sessionFence: isSessionCurrent
        ) else {
            return .skipped
        }

        let nowMillis = nowMillisProvider()
        let device = await deviceProvider(token, nowMillis)
        guard try await isCurrentOrDiscardContext(
            context,
            generation: operationGeneration,
            sessionFence: isSessionCurrent
        ) else {
            return .skipped
        }

        _ = try await repository.register(
            memberId: context.memberId,
            environment: context.environment,
            device: device,
            isRegistrationCurrent: { [weak self] in
                guard let self else { return false }
                return try await self.isCurrent(
                    context,
                    generation: operationGeneration,
                    sessionFence: isSessionCurrent
                )
            }
        )

        guard try await isCurrent(
            context,
            generation: operationGeneration,
            sessionFence: isSessionCurrent
        ) else {
            return .skipped
        }
        return .registered
    }

    private func isCurrentOrDiscardContext(
        _ context: AuthorizedDeviceSessionContext,
        generation operationGeneration: UInt64,
        sessionFence: @escaping @MainActor @Sendable () -> Bool
    ) async throws -> Bool {
        guard try await isCurrent(
            context,
            generation: operationGeneration,
            sessionFence: sessionFence
        ) else {
            try await discardContextIfOwned(context)
            return false
        }
        return true
    }

    private func performTokenUpdate(_ token: String?) async throws {
        let normalizedToken = normalize(token)
        try await keychainStore.saveString(normalizedToken, for: .fcmToken)
        guard let normalizedToken else { return }

        let initialGeneration = generation
        guard let context = try await keychainStore.load(
            AuthorizedDeviceSessionContext.self,
            for: .authorizedDeviceContext
        ) else {
            return
        }
        guard generation == initialGeneration else { return }
        if let activeContext, activeContext != context {
            return
        }
        activeContext = context
        let operationGeneration = generation

        guard try await isCurrentPersisted(
            context,
            generation: operationGeneration
        ) else {
            return
        }
        let nowMillis = nowMillisProvider()
        let device = await deviceProvider(normalizedToken, nowMillis)
        guard try await isCurrentPersisted(
            context,
            generation: operationGeneration
        ) else {
            return
        }

        _ = try await repository.register(
            memberId: context.memberId,
            environment: context.environment,
            device: device,
            isRegistrationCurrent: { [weak self] in
                guard let self else { return false }
                return try await self.isCurrentPersisted(
                    context,
                    generation: operationGeneration
                )
            }
        )
    }

    private func performAuthorizationClear(
        ifOwnedBy lease: AuthorizedDeviceSessionLease
    ) async throws {
        let expectedContext: AuthorizedDeviceSessionContext
        if let activeContext {
            guard activeContext.lease == lease else { return }
            expectedContext = activeContext
            self.activeContext = nil
            generation &+= 1
        } else {
            generation &+= 1
            let clearGeneration = generation
            guard let storedContext = try await keychainStore.load(
                AuthorizedDeviceSessionContext.self,
                for: .authorizedDeviceContext
            ) else {
                try await keychainStore.remove(.legacyAuthorizedMemberId)
                return
            }
            guard
                generation == clearGeneration,
                activeContext == nil,
                storedContext.lease == lease
            else {
                return
            }
            expectedContext = storedContext
        }

        _ = try await keychainStore.remove(
            .authorizedDeviceContext,
            ifMatching: expectedContext
        )
        try await keychainStore.remove(.legacyAuthorizedMemberId)
    }

    private func fetchTokenWithRetry() async throws -> String? {
        for attempt in 0..<2 {
            let fetchedToken: String?
            do {
                fetchedToken = try await tokenProvider()
            } catch is CancellationError {
                throw CancellationError()
            } catch {
                Self.logger.error(
                    "Firebase Messaging token fetch failed: \(String(describing: error), privacy: .private)"
                )
                fetchedToken = nil
            }

            if let normalizedToken = normalize(fetchedToken) {
                try await keychainStore.saveString(normalizedToken, for: .fcmToken)
                return normalizedToken
            }
            if attempt == 0 {
                try await retryDelay()
            }
        }
        return try await keychainStore.loadString(for: .fcmToken)
    }

    private func isCurrent(
        _ context: AuthorizedDeviceSessionContext,
        generation operationGeneration: UInt64,
        sessionFence: @escaping @MainActor @Sendable () -> Bool
    ) async throws -> Bool {
        guard generation == operationGeneration, activeContext == context else { return false }
        guard await sessionFence() else { return false }
        guard generation == operationGeneration, activeContext == context else { return false }
        return try await isCurrentPersisted(
            context,
            generation: operationGeneration
        )
    }

    private func isCurrentPersisted(
        _ context: AuthorizedDeviceSessionContext,
        generation operationGeneration: UInt64
    ) async throws -> Bool {
        guard generation == operationGeneration, activeContext == context else { return false }
        guard await currentAuthUidProvider() == context.authUid else { return false }
        guard generation == operationGeneration, activeContext == context else { return false }
        let persistedContext = try await keychainStore.load(
            AuthorizedDeviceSessionContext.self,
            for: .authorizedDeviceContext
        )
        return generation == operationGeneration &&
            activeContext == context &&
            persistedContext == context
    }

    private func discardContextIfOwned(_ context: AuthorizedDeviceSessionContext) async throws {
        _ = try await keychainStore.remove(
            .authorizedDeviceContext,
            ifMatching: context
        )
        if activeContext == context {
            activeContext = nil
        }
    }

    private func normalize(_ value: String?) -> String? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

@MainActor
private func fetchFirebaseMessagingToken() async throws -> String? {
    try await withCheckedThrowingContinuation { continuation in
        Messaging.messaging().token { token, error in
            if let error {
                continuation.resume(throwing: error)
            } else {
                continuation.resume(returning: token)
            }
        }
    }
}

@MainActor
private func makeCurrentIOSDevice(token: String?, nowMillis: Int64) -> RegisteredDevice {
    RegisteredDevice(
        deviceId: UIDevice.current.identifierForVendor?.uuidString ?? "ios-\(UIDevice.current.model)",
        platform: "ios",
        appVersion: resolveInstalledAppVersion(),
        osVersion: UIDevice.current.systemVersion,
        apiLevel: nil,
        manufacturer: "Apple",
        model: UIDevice.current.model.nilIfBlank,
        fcmToken: token,
        firstSeenAtMillis: nowMillis,
        lastSeenAtMillis: nowMillis,
        tokenUpdatedAtMillis: token == nil ? nil : nowMillis
    )
}

private extension String {
    var nilIfBlank: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
