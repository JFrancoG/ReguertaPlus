import FirebaseAuth
import FirebaseMessaging
import Foundation
import OSLog
import UIKit

nonisolated struct AuthorizedDeviceSessionContext: Codable, Equatable {
    let memberId: String
    let authUid: String
    let environment: SessionEnvironment
    let lease: AuthorizedDeviceSessionLease
}

nonisolated private struct AuthorizedDeviceProcessAuthorization {
    let context: AuthorizedDeviceSessionContext
    let sessionFence: @MainActor @Sendable () -> Bool
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
    private var activeAuthorization: AuthorizedDeviceProcessAuthorization?
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
        let authorization = AuthorizedDeviceProcessAuthorization(
            context: context,
            sessionFence: isSessionCurrent
        )
        activeAuthorization = authorization

        guard await isSessionCurrent() else {
            if isActive(authorization, generation: operationGeneration) {
                activeAuthorization = nil
            }
            return .skipped
        }

        try await keychainStore.save(context, for: .authorizedDeviceContext)
        try await keychainStore.remove(.legacyAuthorizedMemberId)

        guard try await isCurrentOrDiscardContext(
            authorization,
            generation: operationGeneration
        ) else {
            return .skipped
        }

        let token = try await fetchTokenWithRetry()
        guard try await isCurrentRegistration(
            authorization,
            generation: operationGeneration,
            expectedToken: token
        ) else {
            return .skipped
        }

        guard try await writeDeviceRegistration(
            authorization,
            generation: operationGeneration,
            token: token
        ) else {
            return .skipped
        }
        return .registered
    }

    private func writeDeviceRegistration(
        _ authorization: AuthorizedDeviceProcessAuthorization,
        generation operationGeneration: UInt64,
        token: String?
    ) async throws -> Bool {
        let nowMillis = nowMillisProvider()
        let device = await deviceProvider(token, nowMillis)
        guard try await isCurrentRegistration(
            authorization,
            generation: operationGeneration,
            expectedToken: token
        ) else {
            return false
        }

        let context = authorization.context
        _ = try await repository.register(
            memberId: context.memberId,
            environment: context.environment,
            device: device,
            isRegistrationCurrent: { [weak self] in
                guard let self else { return false }
                return try await self.isCurrentRegistration(
                    authorization,
                    generation: operationGeneration,
                    expectedToken: token
                )
            }
        )
        return try await isCurrentRegistration(
            authorization,
            generation: operationGeneration,
            expectedToken: token
        )
    }

    private func isCurrentOrDiscardContext(
        _ authorization: AuthorizedDeviceProcessAuthorization,
        generation operationGeneration: UInt64
    ) async throws -> Bool {
        guard try await isCurrent(
            authorization,
            generation: operationGeneration
        ) else {
            try await discardContextIfOwned(
                authorization.context,
                generation: operationGeneration
            )
            return false
        }
        return true
    }

    private func performTokenUpdate(_ token: String?) async throws {
        let normalizedToken = normalize(token)
        try await keychainStore.saveString(normalizedToken, for: .fcmToken)
        guard let normalizedToken else { return }

        guard let authorization = activeAuthorization else {
            _ = try await keychainStore.load(
                AuthorizedDeviceSessionContext.self,
                for: .authorizedDeviceContext
            )
            return
        }
        let context = authorization.context
        let operationGeneration = generation

        guard try await isCurrentRegistration(
            authorization,
            generation: operationGeneration,
            expectedToken: normalizedToken
        ) else {
            return
        }
        let nowMillis = nowMillisProvider()
        let device = await deviceProvider(normalizedToken, nowMillis)
        guard try await isCurrentRegistration(
            authorization,
            generation: operationGeneration,
            expectedToken: normalizedToken
        ) else {
            return
        }

        _ = try await repository.register(
            memberId: context.memberId,
            environment: context.environment,
            device: device,
            isRegistrationCurrent: { [weak self] in
                guard let self else { return false }
                return try await self.isCurrentRegistration(
                    authorization,
                    generation: operationGeneration,
                    expectedToken: normalizedToken
                )
            }
        )
    }

    private func performAuthorizationClear(ifOwnedBy lease: AuthorizedDeviceSessionLease) async throws {
        let expectedContext: AuthorizedDeviceSessionContext
        if let activeAuthorization {
            guard activeAuthorization.context.lease == lease else { return }
            expectedContext = activeAuthorization.context
            self.activeAuthorization = nil
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
                activeAuthorization == nil,
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
            try Task.checkCancellation()

            if let normalizedToken = normalize(fetchedToken) {
                try await keychainStore.saveString(normalizedToken, for: .fcmToken)
                return normalizedToken
            }
            if attempt == 0 {
                try await retryDelay()
                try Task.checkCancellation()
            }
        }
        return try await keychainStore.loadString(for: .fcmToken)
    }

    private func isCurrent(
        _ authorization: AuthorizedDeviceProcessAuthorization,
        generation operationGeneration: UInt64
    ) async throws -> Bool {
        let context = authorization.context
        guard isActive(authorization, generation: operationGeneration) else { return false }
        guard await authorization.sessionFence() else { return false }
        guard isActive(authorization, generation: operationGeneration) else { return false }
        guard await currentAuthUidProvider() == context.authUid else { return false }
        guard isActive(authorization, generation: operationGeneration) else { return false }
        let persistedContext = try await keychainStore.load(
            AuthorizedDeviceSessionContext.self,
            for: .authorizedDeviceContext
        )
        guard
            isActive(authorization, generation: operationGeneration),
            persistedContext == context,
            await authorization.sessionFence()
        else {
            return false
        }
        return isActive(authorization, generation: operationGeneration)
    }

    private func isCurrentRegistration(
        _ authorization: AuthorizedDeviceProcessAuthorization,
        generation operationGeneration: UInt64,
        expectedToken: String?
    ) async throws -> Bool {
        guard try await isCurrent(
            authorization,
            generation: operationGeneration
        ) else {
            return false
        }
        let persistedToken = try await keychainStore.loadString(for: .fcmToken)
        guard persistedToken == expectedToken else { return false }
        return try await isCurrent(
            authorization,
            generation: operationGeneration
        )
    }

    private func isActive(
        _ authorization: AuthorizedDeviceProcessAuthorization,
        generation operationGeneration: UInt64
    ) -> Bool {
        generation == operationGeneration &&
            activeAuthorization?.context == authorization.context
    }

    private func discardContextIfOwned(
        _ context: AuthorizedDeviceSessionContext,
        generation operationGeneration: UInt64
    ) async throws {
        _ = try await keychainStore.remove(
            .authorizedDeviceContext,
            ifMatching: context
        )
        if generation == operationGeneration,
           activeAuthorization?.context == context {
            activeAuthorization = nil
        }
    }

    private func normalize(_ value: String?) -> String? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

@MainActor private func fetchFirebaseMessagingToken() async throws -> String? {
    let token: String? = try await withCheckedThrowingContinuation { continuation in
        Messaging.messaging().token { token, error in
            if let error {
                continuation.resume(throwing: error)
            } else {
                continuation.resume(returning: token)
            }
        }
    }
    try Task.checkCancellation()
    return token
}

@MainActor private func makeCurrentIOSDevice(token: String?, nowMillis: Int64) -> RegisteredDevice {
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
