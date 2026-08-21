import Foundation
import Security
import Synchronization
import Testing

@testable import Reguerta

@MainActor
struct AuthorizedDeviceLeaseHandoffScenario {
    let principal: AuthPrincipal
    let provider: AuthorizedDeviceLeaseHandoffAuthProvider
    let registrar: AuthorizedDeviceLeaseHandoffRegistrar
    let repository: AuthorizedDeviceLeaseHandoffRepository
    let store: KeychainStore
    let timeoutWaiter: AuthorizedDeviceLeaseHandoffTimeoutWaiter
    let viewModel: SessionViewModel

    func cancelAll() {
        provider.cancelAll()
        registrar.cancelAll()
        repository.cancelAll()
        timeoutWaiter.cancelAll()
    }
}

@MainActor
func makeAuthorizedDeviceLeaseHandoffScenario(
    suspendedRegistrarRegistrationIndex: Int? = 1,
    suspendedRepositoryRegistrationIndex: Int? = nil
) -> AuthorizedDeviceLeaseHandoffScenario {
    let member = authorizedDeviceLeaseHandoffMember()
    let principal = AuthPrincipal(uid: member.authUid ?? "", email: member.normalizedEmail)
    let provider = AuthorizedDeviceLeaseHandoffAuthProvider()
    let repository = AuthorizedDeviceLeaseHandoffRepository(
        suspendedRegistrationIndex: suspendedRepositoryRegistrationIndex
    )
    let store = KeychainStore(
        client: AuthorizedDeviceLeaseHandoffKeychainClient(),
        service: "tests.authorized-device-lease-handoff"
    )
    let coordinator = FirebaseAuthorizedDeviceCoordinator(
        repository: repository,
        keychainStore: store,
        nowMillisProvider: { 1_000 },
        tokenProvider: { "registration-token" },
        currentAuthUidProvider: { principal.uid },
        deviceProvider: { token, nowMillis in
            authorizedDeviceLeaseHandoffDevice(token: token, nowMillis: nowMillis)
        },
        retryDelay: {}
    )
    let registrar = AuthorizedDeviceLeaseHandoffRegistrar(
        coordinator: coordinator,
        suspendedRegistrationIndex: suspendedRegistrarRegistrationIndex
    )
    let memberRepository = AuthorizedDeviceLeaseHandoffMemberRepository(member: member)
    let timeoutWaiter = AuthorizedDeviceLeaseHandoffTimeoutWaiter()
    let viewModel = SessionViewModel(
        repository: memberRepository,
        authSessionProvider: provider,
        resolveAuthorizedSession: ResolveAuthorizedSessionUseCase(
            repository: memberRepository,
            resolver: AuthorizedDeviceLeaseHandoffMemberResolver(member: member)
        ),
        authorizedDeviceRegistrar: registrar,
        environmentRouter: FixedSessionEnvironmentRouter(),
        sessionRefreshPolicy: SessionRefreshPolicy(minimumForegroundIntervalMillis: 0),
        nowMillisProvider: { 1_000 },
        sessionOperationSleeper: { _ in try await timeoutWaiter.waitUntilCancelled() }
    )
    return AuthorizedDeviceLeaseHandoffScenario(
        principal: principal,
        provider: provider,
        registrar: registrar,
        repository: repository,
        store: store,
        timeoutWaiter: timeoutWaiter,
        viewModel: viewModel
    )
}

@MainActor
final class AuthorizedDeviceLeaseHandoffAuthProvider: AuthSessionProvider {
    private var refreshContinuations: [CheckedContinuation<AuthSessionRefreshResult, Never>?] = []
    private let refreshStarts = AuthorizedDeviceLeaseHandoffEventCounter()

    func signIn(email _: String, password _: String) async -> AuthSignInResult {
        .failure(.unknown)
    }

    func signUp(email _: String, password _: String) async -> AuthSignUpResult {
        .failure(.unknown)
    }

    func sendPasswordReset(email _: String) async -> AuthPasswordResetResult {
        .failure(.unknown)
    }

    func sendCurrentUserEmailVerification() async -> Bool {
        false
    }

    func validIDToken(forcingRefresh _: Bool) async throws -> String {
        "test-token"
    }

    func refreshCurrentSession() async -> AuthSessionRefreshResult {
        await withCheckedContinuation { continuation in
            refreshContinuations.append(continuation)
            refreshStarts.recordEvent()
        }
    }

    @discardableResult func signOut() -> Bool {
        true
    }

    func waitForRefreshRequestCount(_ count: Int) async throws {
        try await refreshStarts.waitForEventCount(count)
    }

    func completeRefresh(at index: Int = 0, with result: AuthSessionRefreshResult) {
        guard refreshContinuations.indices.contains(index),
              let continuation = refreshContinuations[index] else {
            Issue.record("No existe el refresh controlado \(index)")
            return
        }
        refreshContinuations[index] = nil
        continuation.resume(returning: result)
    }

    func cancelAll() {
        refreshStarts.cancelAll()
        let continuations = refreshContinuations.compactMap { $0 }
        refreshContinuations = []
        continuations.forEach { $0.resume(returning: .noSession) }
    }
}

final class AuthorizedDeviceLeaseHandoffRegistrar: AuthorizedDeviceRegistrar, Sendable {
    typealias SessionFence = @MainActor @Sendable () -> Bool

    private struct State {
        var commands: [AuthorizedDeviceRegistrationCommand] = []
        var clearedLeases: [AuthorizedDeviceSessionLease] = []
    }

    private let coordinator: FirebaseAuthorizedDeviceCoordinator
    private let suspendedRegistrationIndex: Int?
    private let state = Mutex(State())
    private let registrationStarts = AuthorizedDeviceLeaseHandoffEventCounter()
    private let registrationCompletions = AuthorizedDeviceLeaseHandoffEventCounter()
    private let suspendedRegistrationGate = AuthorizedDeviceLeaseHandoffGate()

    init(coordinator: FirebaseAuthorizedDeviceCoordinator, suspendedRegistrationIndex: Int?) {
        self.coordinator = coordinator
        self.suspendedRegistrationIndex = suspendedRegistrationIndex
    }

    func register(
        command: AuthorizedDeviceRegistrationCommand,
        isSessionCurrent: @escaping SessionFence
    ) async throws -> AuthorizedDeviceRegistrationResult {
        let registrationIndex = state.withLock { state in
            let registrationIndex = state.commands.count
            state.commands.append(command)
            return registrationIndex
        }
        registrationStarts.recordEvent()
        if suspendedRegistrationIndex == registrationIndex {
            await suspendedRegistrationGate.waitIgnoringCancellation()
        }
        defer { registrationCompletions.recordEvent() }
        return try await coordinator.register(
            command: command,
            isSessionCurrent: isSessionCurrent
        )
    }

    func updateRegistrationToken(_ token: String?) async throws {
        try await coordinator.updateRegistrationToken(token)
    }

    func clearAuthorization(ifOwnedBy lease: AuthorizedDeviceSessionLease) async throws {
        state.withLock { $0.clearedLeases.append(lease) }
        try await coordinator.clearAuthorization(ifOwnedBy: lease)
    }

    func waitForRegistrationCount(_ count: Int) async throws {
        try await registrationStarts.waitForEventCount(count)
    }

    func waitForRegistrationCompletionCount(_ count: Int) async throws {
        try await registrationCompletions.waitForEventCount(count)
    }

    func releaseSuspendedRegistration() {
        suspendedRegistrationGate.open()
    }

    func command(at index: Int) -> AuthorizedDeviceRegistrationCommand? {
        state.withLock { state in
            guard state.commands.indices.contains(index) else { return nil }
            return state.commands[index]
        }
    }

    var registrationCount: Int {
        state.withLock { $0.commands.count }
    }

    func clearedLeaseIDs() -> [UUID] {
        state.withLock { $0.clearedLeases.map(\.id) }
    }

    func cancelAll() {
        registrationStarts.cancelAll()
        registrationCompletions.cancelAll()
        suspendedRegistrationGate.open()
    }
}

@MainActor
final class AuthorizedDeviceLeaseHandoffRepository: DeviceRegistrationRepository {
    private let suspendedRegistrationIndex: Int?
    private let registrationAttempts = AuthorizedDeviceLeaseHandoffEventCounter()
    private let suspendedRegistrationGate = AuthorizedDeviceLeaseHandoffGate()
    private var sessionFences: [@Sendable () async throws -> Bool] = []
    private(set) var registrations: [AuthorizedDeviceLeaseHandoffRegistration] = []

    init(suspendedRegistrationIndex: Int?) {
        self.suspendedRegistrationIndex = suspendedRegistrationIndex
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
        let registrationIndex = sessionFences.count
        sessionFences.append(isRegistrationCurrent)
        registrationAttempts.recordEvent()
        if suspendedRegistrationIndex == registrationIndex {
            await suspendedRegistrationGate.waitIgnoringCancellation()
        }
        guard try await isRegistrationCurrent() else {
            throw DeviceRegistrationRepositoryError.staleSession
        }
        registrations.append(
            AuthorizedDeviceLeaseHandoffRegistration(
                memberId: memberId,
                environment: environment,
                token: device.fcmToken
            )
        )
        return device
    }

    var registrationAttemptCount: Int {
        sessionFences.count
    }

    func waitForRegistrationAttemptCount(_ count: Int) async throws {
        try await registrationAttempts.waitForEventCount(count)
    }

    func isRegistrationCurrent(at index: Int) async throws -> Bool? {
        guard sessionFences.indices.contains(index) else { return nil }
        return try await sessionFences[index]()
    }

    func releaseSuspendedRegistration() {
        suspendedRegistrationGate.open()
    }

    func cancelAll() {
        registrationAttempts.cancelAll()
        suspendedRegistrationGate.open()
    }
}

struct AuthorizedDeviceLeaseHandoffRegistration: Equatable {
    let memberId: String
    let environment: SessionEnvironment
    let token: String?
}

private struct AuthorizedDeviceLeaseHandoffMemberResolver: AuthorizedMemberResolving {
    let member: Member

    func resolve(
        authPrincipal _: AuthPrincipal,
        requestedEnvironment: SessionEnvironment
    ) async throws -> AuthorizedMemberResolution {
        AuthorizedMemberResolution(
            memberId: member.id,
            roles: member.roles,
            isActive: member.isActive,
            environment: requestedEnvironment,
            firstLoginLinked: false
        )
    }
}

private struct AuthorizedDeviceLeaseHandoffMemberRepository: MemberRepository {
    let member: Member

    func member(id: String, environment _: SessionEnvironment) async throws -> Member? {
        id == member.id ? member : nil
    }

    func members(visibleTo _: Member, environment _: SessionEnvironment) async throws -> [Member] {
        [member]
    }

    func updateOwnProducerCatalogEnabled(
        member: Member,
        enabled _: Bool,
        environment _: SessionEnvironment
    ) async throws -> Member {
        member
    }
}

private final class AuthorizedDeviceLeaseHandoffKeychainClient: KeychainClient {
    private let storage = Mutex<[String: Data]>([:])

    func read(service _: String, account: String) -> KeychainReadResult {
        storage.withLock { values in
            guard let data = values[account] else {
                return KeychainReadResult(status: errSecItemNotFound, data: nil)
            }
            return KeychainReadResult(status: errSecSuccess, data: data)
        }
    }

    func update(service _: String, account: String, data: Data) -> OSStatus {
        storage.withLock { values in
            guard values[account] != nil else { return errSecItemNotFound }
            values[account] = data
            return errSecSuccess
        }
    }

    func add(service _: String, account: String, data: Data) -> OSStatus {
        storage.withLock { values in
            guard values[account] == nil else { return errSecDuplicateItem }
            values[account] = data
            return errSecSuccess
        }
    }

    func delete(service _: String, account: String) -> OSStatus {
        storage.withLock { values in
            guard values.removeValue(forKey: account) != nil else { return errSecItemNotFound }
            return errSecSuccess
        }
    }
}

@MainActor
private func authorizedDeviceLeaseHandoffMember() -> Member {
    Member(
        id: "lease_handoff_member",
        displayName: "Lease Handoff Member",
        normalizedEmail: "lease-handoff@example.com",
        authUid: "lease_handoff_auth",
        roles: [.member],
        isActive: true,
        producerCatalogEnabled: true
    )
}

@MainActor
private func authorizedDeviceLeaseHandoffDevice(token: String?, nowMillis: Int64) -> RegisteredDevice {
    RegisteredDevice(
        deviceId: "lease-handoff-device",
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
}
