import Foundation
import Security
import Synchronization
import Testing
@testable import Reguerta

@MainActor
struct P101AuthorizedDeviceCoordinatorTests {
    @Test func registrationPersistsUidEnvironmentAndLeaseBeforeWriting() async throws {
        let harness = makeHarness(currentAuthUid: "uid-a")
        let lease = AuthorizedDeviceSessionLease()

        let result = try await harness.coordinator.register(
            command: command(
                memberId: "member-a",
                authUid: "uid-a",
                environment: .develop,
                lease: lease
            ),
            isSessionCurrent: { true }
        )

        #expect(result == .registered)
        #expect(harness.repository.registrations.map(\.environment) == [.develop])
        #expect(
            try await harness.store.load(
                AuthorizedDeviceSessionContext.self,
                for: .authorizedDeviceContext
            ) == AuthorizedDeviceSessionContext(
                memberId: "member-a",
                authUid: "uid-a",
                environment: .develop,
                lease: lease
            )
        )
    }

    @Test func mismatchedFirebaseUidFailsClosedBeforeFirestore() async throws {
        let harness = makeHarness(currentAuthUid: "uid-b")

        let result = try await harness.coordinator.register(
            command: command(
                memberId: "member-a",
                authUid: "uid-a",
                environment: .develop
            ),
            isSessionCurrent: { true }
        )

        #expect(result == .skipped)
        #expect(harness.repository.registrations.isEmpty)
        #expect(
            try await harness.store.load(
                AuthorizedDeviceSessionContext.self,
                for: .authorizedDeviceContext
            ) == nil
        )
    }

    @Test func lateClearFromSessionADoesNotDeleteSessionB() async throws {
        let authUid = CurrentAuthUid("uid-a")
        let harness = makeHarness(currentAuthUidProvider: { authUid.value })
        let leaseA = AuthorizedDeviceSessionLease()
        let leaseB = AuthorizedDeviceSessionLease()

        _ = try await harness.coordinator.register(
            command: command(
                memberId: "member-a",
                authUid: "uid-a",
                environment: .develop,
                lease: leaseA
            ),
            isSessionCurrent: { true }
        )
        authUid.value = "uid-b"
        _ = try await harness.coordinator.register(
            command: command(
                memberId: "member-b",
                authUid: "uid-b",
                environment: .production,
                lease: leaseB
            ),
            isSessionCurrent: { true }
        )

        try await harness.coordinator.clearAuthorization(ifOwnedBy: leaseA)

        let storedContext = try await harness.store.load(
            AuthorizedDeviceSessionContext.self,
            for: .authorizedDeviceContext
        )
        #expect(storedContext?.memberId == "member-b")
        #expect(storedContext?.environment == .production)
        #expect(storedContext?.lease == leaseB)
    }

    @Test func suspendedRegistrationAIsDiscardedAfterSessionBReplacesIt() async throws {
        let authUid = CurrentAuthUid("uid-a")
        let tokenSource = FirstTokenRequestGate()
        let harness = makeHarness(
            currentAuthUidProvider: { authUid.value },
            tokenProvider: { await tokenSource.nextToken() }
        )
        let leaseA = AuthorizedDeviceSessionLease()
        let leaseB = AuthorizedDeviceSessionLease()

        let registrationA = Task {
            try await harness.coordinator.register(
                command: command(
                    memberId: "member-a",
                    authUid: "uid-a",
                    environment: .develop,
                    lease: leaseA
                ),
                isSessionCurrent: { true }
            )
        }
        await tokenSource.waitUntilFirstRequestStarts()

        authUid.value = "uid-b"
        let resultB = try await harness.coordinator.register(
            command: command(
                memberId: "member-b",
                authUid: "uid-b",
                environment: .production,
                lease: leaseB
            ),
            isSessionCurrent: { true }
        )
        await tokenSource.releaseFirstRequest()
        let resultA = try await registrationA.value

        #expect(resultA == .skipped)
        #expect(resultB == .registered)
        #expect(harness.repository.registrations.map(\.memberId) == ["member-b"])
        #expect(harness.repository.registrations.map(\.environment) == [.production])
    }

    @Test func repositoryRevalidationStopsAWriteAfterItsLeaseIsCleared() async throws {
        let started = TestSignal()
        let release = TestGate()
        let repository = RecordingDeviceRegistrationRepository(
            suspendedMemberId: "member-a",
            started: started,
            release: release
        )
        let harness = makeHarness(
            currentAuthUid: "uid-a",
            repository: repository
        )
        let lease = AuthorizedDeviceSessionLease()

        let registration = Task {
            try await harness.coordinator.register(
                command: command(
                    memberId: "member-a",
                    authUid: "uid-a",
                    environment: .develop,
                    lease: lease
                ),
                isSessionCurrent: { true }
            )
        }
        await started.wait()
        try await harness.coordinator.clearAuthorization(ifOwnedBy: lease)
        await release.open()

        #expect(try await registration.value == .skipped)
        #expect(repository.registrations.isEmpty)
    }

    @Test func corruptContextDoesNotBecomeAnAbsentSessionDuringTokenRefresh() async {
        let client = InMemoryKeychainClient()
        client.setRaw(
            Data("not-json".utf8),
            account: KeychainKey.authorizedDeviceContext.rawValue
        )
        let harness = makeHarness(currentAuthUid: "uid-a", client: client)

        await #expect(throws: KeychainStoreError.corruptedValue(key: .authorizedDeviceContext)) {
            try await harness.coordinator.updateRegistrationToken("token")
        }
        #expect(harness.repository.registrations.isEmpty)
    }

    @Test func legacyMemberOnlyValueIsNeverUsedForTokenRefresh() async throws {
        let client = InMemoryKeychainClient()
        client.setRaw(
            Data("member-a".utf8),
            account: KeychainKey.legacyAuthorizedMemberId.rawValue
        )
        let harness = makeHarness(currentAuthUid: "uid-a", client: client)

        try await harness.coordinator.updateRegistrationToken("token")

        #expect(harness.repository.registrations.isEmpty)
    }

    private func makeHarness(
        currentAuthUid: String,
        repository: RecordingDeviceRegistrationRepository = RecordingDeviceRegistrationRepository(),
        client: InMemoryKeychainClient = InMemoryKeychainClient()
    ) -> CoordinatorHarness {
        makeHarness(
            currentAuthUidProvider: { currentAuthUid },
            repository: repository,
            client: client
        )
    }

    private func makeHarness(
        currentAuthUidProvider: @escaping @MainActor @Sendable () -> String?,
        tokenProvider: @escaping @MainActor @Sendable () async throws -> String? = { "token" },
        repository: RecordingDeviceRegistrationRepository = RecordingDeviceRegistrationRepository(),
        client: InMemoryKeychainClient = InMemoryKeychainClient()
    ) -> CoordinatorHarness {
        let store = KeychainStore(client: client, service: "tests.keychain")
        let coordinator = FirebaseAuthorizedDeviceCoordinator(
            repository: repository,
            keychainStore: store,
            nowMillisProvider: { 1_000 },
            tokenProvider: tokenProvider,
            currentAuthUidProvider: currentAuthUidProvider,
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
        return CoordinatorHarness(
            coordinator: coordinator,
            repository: repository,
            store: store
        )
    }

    private func command(
        memberId: String,
        authUid: String,
        environment: SessionEnvironment,
        lease: AuthorizedDeviceSessionLease = AuthorizedDeviceSessionLease()
    ) -> AuthorizedDeviceRegistrationCommand {
        AuthorizedDeviceRegistrationCommand(
            memberId: memberId,
            authUid: authUid,
            environment: environment,
            lease: lease
        )
    }
}

nonisolated private struct CoordinatorHarness: Sendable {
    let coordinator: FirebaseAuthorizedDeviceCoordinator
    let repository: RecordingDeviceRegistrationRepository
    let store: KeychainStore
}

nonisolated private struct RecordedDeviceRegistration: Equatable, Sendable {
    let memberId: String
    let environment: SessionEnvironment
}

@MainActor
private final class RecordingDeviceRegistrationRepository: DeviceRegistrationRepository {
    private let suspendedMemberId: String?
    private let started: TestSignal?
    private let release: TestGate?
    var registrations: [RecordedDeviceRegistration] = []

    init(suspendedMemberId: String? = nil, started: TestSignal? = nil, release: TestGate? = nil) {
        self.suspendedMemberId = suspendedMemberId
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
        if memberId == suspendedMemberId {
            await started?.signal()
            await release?.wait()
        }
        guard try await isRegistrationCurrent() else {
            throw DeviceRegistrationRepositoryError.staleSession
        }
        registrations.append(
            RecordedDeviceRegistration(memberId: memberId, environment: environment)
        )
        return device
    }
}

@MainActor
private final class CurrentAuthUid {
    var value: String?

    init(_ value: String?) {
        self.value = value
    }
}

nonisolated private final class InMemoryKeychainClient: KeychainClient {
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

    func setRaw(_ data: Data, account: String) {
        storage.withLock { values in
            values[account] = data
        }
    }
}

private actor FirstTokenRequestGate {
    private let started = TestSignal()
    private let release = TestGate()
    private var requestCount = 0

    func nextToken() async -> String? {
        requestCount += 1
        if requestCount == 1 {
            await started.signal()
            await release.wait()
            return "token-a"
        }
        return "token-b"
    }

    func waitUntilFirstRequestStarts() async {
        await started.wait()
    }

    func releaseFirstRequest() async {
        await release.open()
    }
}

private actor TestSignal {
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

private actor TestGate {
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
