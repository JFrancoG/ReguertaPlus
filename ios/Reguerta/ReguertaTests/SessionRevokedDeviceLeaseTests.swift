import Foundation
import Synchronization
import Testing

@testable import Reguerta

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct SessionRevokedDeviceLeaseTests {
    @Test func revokedRefreshRejectsLateAndNewDeviceTokensUntilOwnedCleanupFinishes() async throws {
        let scenario = makeRevokedSessionScenario()
        let member = scenario.member
        let principal = scenario.principal
        let provider = scenario.provider
        let registrar = scenario.registrar
        let viewModel = scenario.viewModel
        defer { registrar.cancelAll() }

        await viewModel.applyAuthorizedSession(principal: principal)
        try await registrar.updateRegistrationToken("accepted-before-revocation")
        let lateTokenUpdate = Task {
            try await registrar.updateRegistrationToken("late-token")
        }
        defer { lateTokenUpdate.cancel() }
        try await registrar.waitForLateTokenUpdate()

        viewModel.refreshSession(trigger: .startup)
        guard await provider.waitForRefreshRequestCount(1),
              let refreshOperation = viewModel.sessionOperationTask else {
            Issue.record("Expected the authorized refresh to own the session lane")
            return
        }
        provider.completeRefresh(with: .active(principal))
        try await registrar.waitForClearRequest()
        await refreshOperation.value
        guard let cleanupBarrier = viewModel.sessionOperationTask else {
            Issue.record("Expected device cleanup to retain the draining session lane")
            return
        }

        #expect(viewModel.mode == .unauthorized(email: principal.email, reason: .userAccessRestricted))
        #expect(viewModel.authorizedDeviceSessionLease == nil)
        #expect(viewModel.isSessionOperationDraining)
        #expect(await registrar.isCapturedSessionCurrent() == false)

        try await registrar.updateRegistrationToken("new-token")
        registrar.releaseLateTokenUpdate()
        try await lateTokenUpdate.value
        #expect(await registrar.acceptedTokens() == ["accepted-before-revocation"])

        viewModel.emailInput = member.normalizedEmail
        viewModel.passwordInput = "secret12"
        viewModel.signIn()
        #expect(provider.signInRequestCount == 0)

        registrar.completeClear()
        await cleanupBarrier.value
        #expect(viewModel.sessionOperationState == .idle)
        #expect(viewModel.sessionTerminationCleanupTask == nil)

        try await registrar.updateRegistrationToken("after-cleanup-token")
        #expect(await registrar.acceptedTokens() == ["accepted-before-revocation"])
    }
}

private struct RevokedSessionScenario {
    let member: Member
    let principal: AuthPrincipal
    let provider: ControlledSessionAuthProvider
    let registrar: RevokedSessionDeviceRegistrar
    let viewModel: SessionViewModel
}

@MainActor
private func makeRevokedSessionScenario() -> RevokedSessionScenario {
    let member = revokedSessionMember()
    let principal = AuthPrincipal(uid: member.authUid ?? "", email: member.normalizedEmail)
    let provider = ControlledSessionAuthProvider(isAuthenticated: true)
    let registrar = RevokedSessionDeviceRegistrar()
    let repository = RevokedSessionMemberRepository(member: member)
    let environmentRouter = FixedSessionEnvironmentRouter()
    let viewModel = SessionViewModel(
        repository: repository,
        authSessionProvider: provider,
        resolveAuthorizedSession: ResolveAuthorizedSessionUseCase(
            repository: repository,
            resolver: RevokingAuthorizedMemberResolver(member: member),
            environmentRouter: environmentRouter
        ),
        authorizedDeviceRegistrar: registrar,
        environmentRouter: environmentRouter,
        sessionRefreshPolicy: SessionRefreshPolicy(minimumForegroundIntervalMillis: 0),
        nowMillisProvider: { 1_000 }
    )
    return RevokedSessionScenario(
        member: member,
        principal: principal,
        provider: provider,
        registrar: registrar,
        viewModel: viewModel
    )
}

private actor RevokingAuthorizedMemberResolver: AuthorizedMemberResolving {
    private let member: Member
    private var hasAuthorized = false

    init(member: Member) {
        self.member = member
    }

    func resolve(
        authPrincipal _: AuthPrincipal,
        requestedEnvironment: SessionEnvironment
    ) async throws -> AuthorizedMemberResolution {
        guard !hasAuthorized else {
            throw AuthorizedMemberResolutionError.unauthorized(.userAccessRestricted)
        }
        hasAuthorized = true
        return AuthorizedMemberResolution(
            memberId: member.id,
            roles: member.roles,
            isActive: member.isActive,
            environment: requestedEnvironment,
            firstLoginLinked: false
        )
    }
}

private struct RevokedSessionMemberRepository: MemberRepository {
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

private final class RevokedSessionDeviceRegistrar: AuthorizedDeviceRegistrar, Sendable {
    private struct State {
        var sessionFence: (@MainActor @Sendable () -> Bool)?
        var acceptedTokens: [String] = []
    }

    private let state = Mutex(State())
    private let lateTokenStarted = RevokedSessionTestGate()
    private let lateTokenRelease = RevokedSessionTestGate()
    private let clearStarted = RevokedSessionTestGate()
    private let clearRelease = RevokedSessionTestGate()

    func register(
        command _: AuthorizedDeviceRegistrationCommand,
        isSessionCurrent: @escaping @MainActor @Sendable () -> Bool
    ) async throws -> AuthorizedDeviceRegistrationResult {
        state.withLock { $0.sessionFence = isSessionCurrent }
        return .registered
    }

    func updateRegistrationToken(_ token: String?) async throws {
        guard let token else { return }
        if token == "late-token" {
            lateTokenStarted.open()
            try await lateTokenRelease.wait()
        }
        let sessionFence = state.withLock { $0.sessionFence }
        guard await sessionFence?() == true else { return }
        state.withLock { $0.acceptedTokens.append(token) }
    }

    func clearAuthorization(ifOwnedBy _: AuthorizedDeviceSessionLease) async throws {
        clearStarted.open()
        try await clearRelease.wait()
        state.withLock { $0.sessionFence = nil }
    }

    func waitForLateTokenUpdate() async throws {
        try await lateTokenStarted.wait()
    }

    func waitForClearRequest() async throws {
        try await clearStarted.wait()
    }

    func releaseLateTokenUpdate() {
        lateTokenRelease.open()
    }

    func completeClear() {
        clearRelease.open()
    }

    func isCapturedSessionCurrent() async -> Bool {
        let sessionFence = state.withLock { $0.sessionFence }
        return await sessionFence?() == true
    }

    func acceptedTokens() async -> [String] {
        state.withLock { $0.acceptedTokens }
    }

    func cancelAll() {
        lateTokenStarted.cancelAll()
        lateTokenRelease.cancelAll()
        clearStarted.cancelAll()
        clearRelease.cancelAll()
    }
}

private final class RevokedSessionTestGate: Sendable {
    private enum WaitRegistration {
        case suspended
        case opened
        case cancelled
    }

    private struct State {
        var isOpen = false
        var isCancelled = false
        var waiters: [UUID: CheckedContinuation<Void, any Error>] = [:]
        var cancellationGeneration: UInt64 = 0
    }

    private let state = Mutex(State())

    func wait() async throws {
        let waiterID = UUID()
        let cancellationGeneration = state.withLock { $0.cancellationGeneration }
        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, any Error>) in
                let registration = state.withLock { state -> WaitRegistration in
                    guard !Task.isCancelled,
                          !state.isCancelled,
                          state.cancellationGeneration == cancellationGeneration else { return .cancelled }
                    guard !state.isOpen else { return .opened }
                    state.waiters[waiterID] = continuation
                    return .suspended
                }
                switch registration {
                case .suspended:
                    break
                case .opened:
                    continuation.resume()
                case .cancelled:
                    continuation.resume(throwing: CancellationError())
                }
            }
        } onCancel: {
            self.cancel(waiterID)
        }
    }

    func open() {
        let waiters = state.withLock { state in
            state.isOpen = true
            let waiters = Array(state.waiters.values)
            state.waiters.removeAll()
            return waiters
        }
        waiters.forEach { $0.resume() }
    }

    func cancelAll() {
        let waiters = state.withLock { state in
            state.isCancelled = true
            state.cancellationGeneration &+= 1
            let waiters = Array(state.waiters.values)
            state.waiters.removeAll()
            return waiters
        }
        waiters.forEach { $0.resume(throwing: CancellationError()) }
    }

    private func cancel(_ waiterID: UUID) {
        let continuation = state.withLock { $0.waiters.removeValue(forKey: waiterID) }
        continuation?.resume(throwing: CancellationError())
    }
}

@MainActor
private func revokedSessionMember() -> Member {
    Member(
        id: "revoked_member",
        displayName: "Revoked Member",
        normalizedEmail: "revoked@example.com",
        authUid: "revoked_auth",
        roles: [.member],
        isActive: true,
        producerCatalogEnabled: true
    )
}
