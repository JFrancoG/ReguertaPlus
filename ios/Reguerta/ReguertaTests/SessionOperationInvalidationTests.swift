import Testing

@testable import Reguerta

@MainActor
@Suite(.timeLimit(.minutes(1)))
struct SessionOperationInvalidationTests {
    @Test("Cerrar sesión invalida un inicio de sesión que termina tarde")
    func signOutInvalidatesLateSignInSuccess() async {
        let fixture = authenticatedMember()
        let principal = authenticatedPrincipal(for: fixture)
        let provider = ControlledSessionAuthProvider()
        let viewModel = makeViewModel(
            member: fixture,
            provider: provider,
            resolver: FixedAuthorizedMemberResolver(member: fixture)
        )
        viewModel.emailInput = fixture.normalizedEmail
        viewModel.passwordInput = "secret12"

        viewModel.signIn()
        guard await provider.waitForSignInRequestCount(1) else { return }
        guard let operation = viewModel.sessionOperationTask else {
            Issue.record("La operación de login no tiene propietario")
            return
        }
        viewModel.signOut()
        provider.completeSignIn(with: .success(principal))
        await operation.value

        #expect(viewModel.mode == .signedOut)
        #expect(viewModel.isAuthenticating == false)
        #expect(provider.isAuthenticated == false)
    }

    @Test("Cerrar sesión invalida una restauración de sesión que termina tarde")
    func signOutInvalidatesLateSessionRefresh() async {
        let fixture = authenticatedMember()
        let principal = authenticatedPrincipal(for: fixture)
        let provider = ControlledSessionAuthProvider(isAuthenticated: true)
        let viewModel = makeViewModel(
            member: fixture,
            provider: provider,
            resolver: FixedAuthorizedMemberResolver(member: fixture)
        )
        viewModel.mode = authorizedMode(member: fixture, principal: principal)

        viewModel.refreshSession(trigger: .startup)
        guard await provider.waitForRefreshRequestCount(1) else { return }
        guard let operation = viewModel.sessionOperationTask else {
            Issue.record("La operación de refresh no tiene propietario")
            return
        }
        viewModel.signOut()
        provider.completeRefresh(with: .active(principal))
        await operation.value

        #expect(viewModel.mode == .signedOut)
        #expect(viewModel.isSessionRefreshInFlight == false)
        #expect(viewModel.lastSessionRefreshAtMillis == nil)
        #expect(provider.isAuthenticated == false)
    }

    @Test("Cerrar sesión invalida una autorización pendiente sin reactivar el entorno")
    func signOutInvalidatesPendingMemberResolution() async {
        let fixture = authenticatedMember()
        let principal = authenticatedPrincipal(for: fixture)
        let provider = ControlledSessionAuthProvider(
            signInResult: .success(principal)
        )
        let resolver = ControlledAuthorizedMemberResolver()
        let routingRecorder = SessionRoutingRecorder()
        let viewModel = makeViewModel(
            member: fixture,
            provider: provider,
            resolver: resolver,
            routingRecorder: routingRecorder
        )
        viewModel.emailInput = fixture.normalizedEmail
        viewModel.passwordInput = "secret12"

        viewModel.signIn()
        guard await resolver.waitForRequest() else { return }
        guard let operation = viewModel.sessionOperationTask else {
            Issue.record("La resolución de miembro no tiene una tarea propietaria")
            return
        }
        viewModel.signOut()
        await resolver.complete(with: resolution(for: fixture))
        await operation.value

        #expect(viewModel.mode == .signedOut)
        #expect(viewModel.isAuthenticating == false)
        #expect(routingRecorder.appliedEnvironments.isEmpty)
    }

    @Test("Un nuevo login se rechaza hasta limpiar el resultado antiguo")
    func newerSignInIsRejectedUntilStaleProviderCleanup() async {
        let fixture = authenticatedMember()
        let principal = authenticatedPrincipal(for: fixture)
        let provider = ControlledSessionAuthProvider()
        let viewModel = makeViewModel(
            member: fixture,
            provider: provider,
            resolver: FixedAuthorizedMemberResolver(member: fixture)
        )
        viewModel.emailInput = fixture.normalizedEmail
        viewModel.passwordInput = "secret12"

        viewModel.signIn()
        guard await provider.waitForSignInRequestCount(1) else { return }
        guard let staleOperation = viewModel.sessionOperationTask else {
            Issue.record("El primer login no tiene propietario")
            return
        }
        viewModel.signOut()

        viewModel.emailInput = fixture.normalizedEmail
        viewModel.passwordInput = "secret12"
        viewModel.signIn()
        #expect(viewModel.canSubmitSignIn == false)
        #expect(provider.signInRequestCount == 1)

        provider.completeSignIn(at: 0, with: .success(principal))
        await staleOperation.value
        #expect(provider.isAuthenticated == false)

        viewModel.emailInput = fixture.normalizedEmail
        viewModel.passwordInput = "secret12"
        viewModel.signIn()
        guard let newerOperation = viewModel.sessionOperationTask else {
            Issue.record("El segundo login no tiene propietario tras el drenaje")
            return
        }

        guard await provider.waitForSignInRequestCount(2) else { return }
        #expect(provider.events == [
            .signInStarted(0),
            .signOut,
            .signInCompleted(0),
            .signOut,
            .signInStarted(1)
        ])
        provider.completeSignIn(at: 1, with: .success(principal))
        await newerOperation.value

        #expect(viewModel.mode.isAuthenticatedSession)
        #expect(provider.isAuthenticated)
        #expect(provider.signOutCallCount == 2)
        #expect(provider.events.last == .signInCompleted(1))
    }

    @Test("El refresh automático no interrumpe un login interactivo")
    func automaticRefreshDoesNotCancelInteractiveSignIn() async {
        let fixture = authenticatedMember()
        let principal = authenticatedPrincipal(for: fixture)
        let provider = ControlledSessionAuthProvider(refreshResult: .noSession)
        let viewModel = makeViewModel(
            member: fixture,
            provider: provider,
            resolver: FixedAuthorizedMemberResolver(member: fixture)
        )
        viewModel.emailInput = fixture.normalizedEmail
        viewModel.passwordInput = "secret12"

        viewModel.signIn()
        guard await provider.waitForSignInRequestCount(1) else { return }
        guard let signInOperation = viewModel.sessionOperationTask else {
            Issue.record("El login no tiene propietario")
            return
        }

        viewModel.refreshSession(trigger: .foreground)

        #expect(viewModel.isAuthenticating)
        #expect(viewModel.isSessionRefreshInFlight == false)
        provider.completeSignIn(with: .success(principal))
        await signInOperation.value
        if let remainingOperation = viewModel.sessionOperationTask {
            await remainingOperation.value
        }

        #expect(provider.refreshRequestCount == 0)
        #expect(viewModel.mode.isAuthenticatedSession)
        #expect(provider.isAuthenticated)
    }

    @Test("La verificación pendiente termina el refresh sin conservar tracking")
    func emailVerificationRefreshInvalidatesTracking() async {
        let fixture = authenticatedMember()
        let principal = authenticatedPrincipal(for: fixture)
        let provider = ControlledSessionAuthProvider(isAuthenticated: true)
        let viewModel = makeViewModel(
            member: fixture,
            provider: provider,
            resolver: FixedAuthorizedMemberResolver(member: fixture)
        )
        viewModel.mode = authorizedMode(member: fixture, principal: principal)

        viewModel.refreshSession(trigger: .startup)
        guard await provider.waitForRefreshRequestCount(1) else { return }
        guard let operation = viewModel.sessionOperationTask else {
            Issue.record("La operación de refresh no tiene propietario")
            return
        }
        provider.completeRefresh(with: .emailVerificationRequired(email: fixture.normalizedEmail))
        await operation.value

        #expect(viewModel.mode == .signedOut)
        #expect(viewModel.lastSessionRefreshAtMillis == nil)
        #expect(viewModel.isSessionRefreshInFlight == false)
        #expect(provider.isAuthenticated == false)
    }

    @Test("El rollback antiguo no pisa el entorno de una sesión nueva")
    func staleRoutingRollbackDoesNotResetNewerLease() async throws {
        let fixture = authenticatedMember()
        let principal = authenticatedPrincipal(for: fixture)
        let repository = ControlledSessionMemberRepository(member: fixture)
        let routingRecorder = SessionRoutingRecorder()
        let environmentRouter = FixedSessionEnvironmentRouter(
            onApply: { routingRecorder.apply($0) },
            onReset: { routingRecorder.reset() }
        )
        let useCase = ResolveAuthorizedSessionUseCase(
            repository: repository,
            resolver: FixedAuthorizedMemberResolver(
                member: fixture,
                fixedEnvironment: .production
            ),
            environmentRouter: environmentRouter
        )

        let staleOperation = Task {
            try await useCase.execute(authPrincipal: principal)
        }
        guard await repository.waitForMemberRequestCount(1) else { return }
        staleOperation.cancel()
        environmentRouter.resetToBaseEnvironment()

        let newerOperation = Task {
            try await useCase.execute(authPrincipal: principal)
        }
        guard await repository.waitForMemberRequestCount(2) else { return }
        await repository.completeMemberRead(at: 1, with: fixture)

        #expect(
            try await newerOperation.value == .authorized(
                member: fixture,
                environment: .production
            )
        )
        #expect(routingRecorder.currentEnvironment == .production)

        await repository.completeMemberRead(at: 0, with: fixture)
        await #expect(throws: CancellationError.self) {
            try await staleOperation.value
        }
        #expect(routingRecorder.currentEnvironment == .production)
        #expect(routingRecorder.resetCount == 1)
    }

    @Test("El entorno resuelto forma parte de la identidad de la sesión autorizada")
    func resolvedEnvironmentChangesAuthorizedSessionIdentity() async {
        let fixture = authenticatedMember()
        let principal = authenticatedPrincipal(for: fixture)
        let viewModel = makeViewModel(
            member: fixture,
            provider: ControlledSessionAuthProvider(isAuthenticated: true),
            resolver: SequencedEnvironmentAuthorizedMemberResolver(
                member: fixture,
                environments: [.develop, .production]
            )
        )

        await viewModel.applyAuthorizedSession(principal: principal)
        let previousMode = viewModel.mode

        await viewModel.applyAuthorizedSession(principal: principal)

        #expect(viewModel.mode != previousMode)
        guard case .authorized(let session) = viewModel.mode else {
            Issue.record("La sesión debería seguir autorizada")
            return
        }
        #expect(session.environment == .production)
    }

}

@MainActor
private func makeViewModel(
    member: Member,
    provider: ControlledSessionAuthProvider,
    resolver: some AuthorizedMemberResolving,
    routingRecorder: SessionRoutingRecorder? = nil
) -> SessionViewModel {
    let routingRecorder = routingRecorder ?? SessionRoutingRecorder()
    let repository = FixedSessionMemberRepository(member: member)
    let environmentRouter = FixedSessionEnvironmentRouter(
        onApply: { routingRecorder.apply($0) },
        onReset: { routingRecorder.reset() }
    )
    return SessionViewModel(
        repository: repository,
        authSessionProvider: provider,
        resolveAuthorizedSession: ResolveAuthorizedSessionUseCase(
            repository: repository,
            resolver: resolver,
            environmentRouter: environmentRouter
        ),
        environmentRouter: environmentRouter,
        sessionRefreshPolicy: SessionRefreshPolicy(minimumForegroundIntervalMillis: 0),
        nowMillisProvider: { 1_000 }
    )
}

@MainActor private func authenticatedMember() -> Member {
    Member(
        id: "member_1",
        displayName: "Member",
        normalizedEmail: "member@example.com",
        authUid: "auth_1",
        roles: [.member],
        isActive: true,
        producerCatalogEnabled: true
    )
}

private func authenticatedPrincipal(for member: Member) -> AuthPrincipal {
    AuthPrincipal(uid: member.authUid ?? "", email: member.normalizedEmail)
}

private func resolution(for member: Member) -> AuthorizedMemberResolution {
    AuthorizedMemberResolution(
        memberId: member.id,
        roles: member.roles,
        isActive: member.isActive,
        environment: .develop,
        firstLoginLinked: false
    )
}

private func authorizedMode(member: Member, principal: AuthPrincipal) -> SessionMode {
    .authorized(
        AuthorizedSession(
            principal: principal,
            authenticatedMember: member,
            member: member,
            members: [member],
            environment: .develop
        )
    )
}

@MainActor
private final class SessionRoutingRecorder {
    var appliedEnvironments: [SessionEnvironment] = []
    var currentEnvironment: SessionEnvironment?
    var resetCount = 0

    func apply(_ environment: SessionEnvironment) {
        appliedEnvironments.append(environment)
        currentEnvironment = environment
    }

    func reset() {
        currentEnvironment = nil
        resetCount += 1
    }
}

private actor ControlledAuthorizedMemberResolver: AuthorizedMemberResolving {
    private var continuation: CheckedContinuation<AuthorizedMemberResolution, any Error>?
    private var requestWaiters: [Int: CheckedContinuation<Bool, Never>] = [:]
    private var nextRequestWaiterID = 0

    func resolve(
        authPrincipal _: AuthPrincipal,
        requestedEnvironment _: SessionEnvironment
    ) async throws -> AuthorizedMemberResolution {
        try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            let waiters = Array(requestWaiters.values)
            requestWaiters.removeAll()
            waiters.forEach { $0.resume(returning: true) }
        }
    }

    func waitForRequest() async -> Bool {
        if continuation != nil {
            return true
        }

        let waiterID = nextRequestWaiterID
        nextRequestWaiterID += 1
        return await withTaskCancellationHandler {
            await withCheckedContinuation { continuation in
                guard !Task.isCancelled else {
                    continuation.resume(returning: false)
                    return
                }
                requestWaiters[waiterID] = continuation
            }
        } onCancel: {
            Task {
                await self.cancelRequestWaiter(id: waiterID)
            }
        }
    }

    func complete(with result: AuthorizedMemberResolution) {
        let continuation = continuation
        self.continuation = nil
        continuation?.resume(returning: result)
    }

    private func cancelRequestWaiter(id: Int) {
        requestWaiters.removeValue(forKey: id)?.resume(returning: false)
    }
}

nonisolated private struct FixedAuthorizedMemberResolver: AuthorizedMemberResolving {
    let member: Member
    let environment: SessionEnvironment?

    func resolve(
        authPrincipal _: AuthPrincipal,
        requestedEnvironment: SessionEnvironment
    ) async throws -> AuthorizedMemberResolution {
        AuthorizedMemberResolution(
            memberId: member.id,
            roles: member.roles,
            isActive: member.isActive,
            environment: environment ?? requestedEnvironment,
            firstLoginLinked: false
        )
    }
}

private actor SequencedEnvironmentAuthorizedMemberResolver: AuthorizedMemberResolving {
    let member: Member
    var environments: [SessionEnvironment]

    init(member: Member, environments: [SessionEnvironment]) {
        self.member = member
        self.environments = environments
    }

    func resolve(
        authPrincipal _: AuthPrincipal,
        requestedEnvironment: SessionEnvironment
    ) async throws -> AuthorizedMemberResolution {
        let environment = environments.isEmpty
            ? requestedEnvironment
            : environments.removeFirst()
        return AuthorizedMemberResolution(
            memberId: member.id,
            roles: member.roles,
            isActive: member.isActive,
            environment: environment,
            firstLoginLinked: false
        )
    }
}

private extension FixedAuthorizedMemberResolver {
    init(member: Member, fixedEnvironment: SessionEnvironment? = nil) {
        self.member = member
        environment = fixedEnvironment
    }
}

nonisolated private struct FixedSessionMemberRepository: MemberRepository {
    let member: Member

    func member(id: String) async throws -> Member? {
        id == member.id ? member : nil
    }

    func members(visibleTo _: Member) async throws -> [Member] {
        [member]
    }

    func updateOwnProducerCatalogEnabled(member _: Member, enabled _: Bool) async throws -> Member {
        member
    }
}
