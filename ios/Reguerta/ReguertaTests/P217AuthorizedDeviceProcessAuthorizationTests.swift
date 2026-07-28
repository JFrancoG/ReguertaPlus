import Foundation
import Security
import Synchronization
import Testing
@testable import Reguerta

@MainActor
struct P217AuthorizedDeviceProcessAuthorizationTests {
    @Test
    func coldProcessStoresTokenWithoutAdoptingPersistedAuthorization() async throws {
        let harness = makeHarness()
        let context = AuthorizedDeviceSessionContext(
            memberId: "member-a",
            authUid: "uid-a",
            environment: .develop,
            lease: AuthorizedDeviceSessionLease()
        )
        try await harness.store.save(context, for: .authorizedDeviceContext)

        try await harness.coordinator.updateRegistrationToken(" token-b ")

        #expect(try await harness.store.loadString(for: .fcmToken) == "token-b")
        #expect(harness.repository.registrations.isEmpty)
    }

    @Test
    func liveAuthorizationAllowsSubsequentTokenRefresh() async throws {
        let sessionFence = P217CurrentSessionFence(true)
        let harness = makeHarness()

        let result = try await harness.coordinator.register(
            command: command(),
            isSessionCurrent: { sessionFence.value }
        )
        try await harness.coordinator.updateRegistrationToken("token-b")

        #expect(result == .registered)
        #expect(harness.repository.registrations.map(\.fcmToken) == ["token", "token-b"])
    }

    @Test
    func sessionFenceInvalidationDuringTokenUploadPreventsCommit() async throws {
        let started = P217TestSignal()
        let release = P217TestGate()
        let repository = P217RecordingDeviceRegistrationRepository(
            suspendedToken: "token-b",
            started: started,
            release: release
        )
        let sessionFence = P217CurrentSessionFence(true)
        let harness = makeHarness(repository: repository)

        _ = try await harness.coordinator.register(
            command: command(),
            isSessionCurrent: { sessionFence.value }
        )
        let update = Task {
            try await harness.coordinator.updateRegistrationToken("token-b")
        }
        await started.wait()
        sessionFence.value = false
        await release.open()
        try await update.value

        #expect(repository.registrations.map(\.fcmToken) == ["token"])
    }

    @Test
    func supersededTokenUpdateCannotCommitAfterTheNewestToken() async throws {
        let started = P217TestSignal()
        let release = P217TestGate()
        let repository = P217RecordingDeviceRegistrationRepository(
            suspendedToken: "token-a",
            started: started,
            release: release
        )
        let sessionFence = P217CurrentSessionFence(true)
        let harness = makeHarness(repository: repository)
        _ = try await harness.coordinator.register(
            command: command(),
            isSessionCurrent: { sessionFence.value }
        )

        let firstUpdate = Task {
            try await harness.coordinator.updateRegistrationToken("token-a")
        }
        await started.wait()
        try await harness.coordinator.updateRegistrationToken("token-b")
        await release.open()
        try await firstUpdate.value

        #expect(repository.registrations.map(\.fcmToken) == ["token", "token-b"])
        #expect(try await harness.store.loadString(for: .fcmToken) == "token-b")
    }

    private func makeHarness(
        repository: P217RecordingDeviceRegistrationRepository =
            P217RecordingDeviceRegistrationRepository()
    ) -> P217CoordinatorHarness {
        let store = KeychainStore(
            client: P217InMemoryKeychainClient(),
            service: "tests.p217.keychain"
        )
        let coordinator = FirebaseAuthorizedDeviceCoordinator(
            repository: repository,
            keychainStore: store,
            nowMillisProvider: { 1_000 },
            tokenProvider: { "token" },
            currentAuthUidProvider: { "uid-a" },
            deviceProvider: { token, nowMillis in
                RegisteredDevice(
                    deviceId: "device-test",
                    platform: "ios",
                    appVersion: "1.0",
                    osVersion: "26.0",
                    apiLevel: nil,
                    manufacturer: "Apple",
                    model: "iPhone",
                    fcmToken: token,
                    firstSeenAtMillis: nowMillis,
                    lastSeenAtMillis: nowMillis,
                    tokenUpdatedAtMillis: token == nil ? nil : nowMillis
                )
            },
            retryDelay: {}
        )
        return P217CoordinatorHarness(
            coordinator: coordinator,
            repository: repository,
            store: store
        )
    }

    private func command() -> AuthorizedDeviceRegistrationCommand {
        AuthorizedDeviceRegistrationCommand(
            memberId: "member-a",
            authUid: "uid-a",
            environment: .develop,
            lease: AuthorizedDeviceSessionLease()
        )
    }
}

nonisolated private struct P217CoordinatorHarness: Sendable {
    let coordinator: FirebaseAuthorizedDeviceCoordinator
    let repository: P217RecordingDeviceRegistrationRepository
    let store: KeychainStore
}

nonisolated private struct P217RecordedDeviceRegistration: Equatable, Sendable {
    let fcmToken: String?
}

@MainActor
private final class P217RecordingDeviceRegistrationRepository: DeviceRegistrationRepository {
    private let suspendedToken: String?
    private let started: P217TestSignal?
    private let release: P217TestGate?
    var registrations: [P217RecordedDeviceRegistration] = []

    init(
        suspendedToken: String? = nil,
        started: P217TestSignal? = nil,
        release: P217TestGate? = nil
    ) {
        self.suspendedToken = suspendedToken
        self.started = started
        self.release = release
    }

    func register(
        memberId: String,
        environment: SessionEnvironment,
        device: RegisteredDevice,
        isRegistrationCurrent: @escaping @Sendable () async throws -> Bool
    ) async throws -> RegisteredDevice {
        guard try await isRegistrationCurrent() else {
            throw DeviceRegistrationRepositoryError.staleSession
        }
        if suspendedToken != nil, device.fcmToken == suspendedToken {
            await started?.signal()
            await release?.wait()
        }
        guard try await isRegistrationCurrent() else {
            throw DeviceRegistrationRepositoryError.staleSession
        }
        registrations.append(
            P217RecordedDeviceRegistration(fcmToken: device.fcmToken)
        )
        return device
    }
}

@MainActor
private final class P217CurrentSessionFence {
    var value: Bool

    init(_ value: Bool) {
        self.value = value
    }
}

nonisolated private final class P217InMemoryKeychainClient: KeychainClient {
    private let storage = Mutex<[String: Data]>([:])

    func read(service: String, account: String) -> KeychainReadResult {
        storage.withLock { values in
            guard let data = values[account] else {
                return KeychainReadResult(status: errSecItemNotFound, data: nil)
            }
            return KeychainReadResult(status: errSecSuccess, data: data)
        }
    }

    func update(service: String, account: String, data: Data) -> OSStatus {
        storage.withLock { values in
            guard values[account] != nil else { return errSecItemNotFound }
            values[account] = data
            return errSecSuccess
        }
    }

    func add(service: String, account: String, data: Data) -> OSStatus {
        storage.withLock { values in
            guard values[account] == nil else { return errSecDuplicateItem }
            values[account] = data
            return errSecSuccess
        }
    }

    func delete(service: String, account: String) -> OSStatus {
        storage.withLock { values in
            values.removeValue(forKey: account) == nil ? errSecItemNotFound : errSecSuccess
        }
    }
}

private actor P217TestSignal {
    private var isSignaled = false
    private var waiters: [CheckedContinuation<Void, Never>] = []

    func signal() {
        guard !isSignaled else { return }
        isSignaled = true
        let pendingWaiters = waiters
        waiters.removeAll()
        pendingWaiters.forEach { $0.resume() }
    }

    func wait() async {
        if isSignaled { return }
        await withCheckedContinuation { continuation in
            waiters.append(continuation)
        }
    }
}

private actor P217TestGate {
    private var isOpen = false
    private var waiters: [CheckedContinuation<Void, Never>] = []

    func open() {
        guard !isOpen else { return }
        isOpen = true
        let pendingWaiters = waiters
        waiters.removeAll()
        pendingWaiters.forEach { $0.resume() }
    }

    func wait() async {
        if isOpen { return }
        await withCheckedContinuation { continuation in
            waiters.append(continuation)
        }
    }
}
