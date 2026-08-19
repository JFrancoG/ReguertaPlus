import Testing

@testable import Reguerta

extension SessionOperationInvalidationTests {
    @Test("Una operación activa rechaza sucesores sin perder su deadline")
    func activeOperationRejectsSuccessorsWithoutCancellingDeadline() async throws {
        let scenario = makeSessionTimeoutScenario()
        scenario.viewModel.emailInput = scenario.member.normalizedEmail
        scenario.viewModel.passwordInput = "secret12"
        scenario.viewModel.signIn()
        guard await scenario.provider.waitForSignInRequestCount(1) else { return }
        try await scenario.sleeper.waitForRequestCount(1)
        guard scenario.viewModel.sessionOperationTimeoutTask != nil,
              let operation = scenario.viewModel.sessionOperationTask else {
            Issue.record("La operación activa perdió su propietario o deadline")
            return
        }

        populateValidAccessDrafts(in: scenario.viewModel, member: scenario.member)
        scenario.viewModel.signIn()
        scenario.viewModel.signUp()
        #expect(scenario.provider.signInRequestCount == 1)
        #expect(scenario.provider.signUpRequestCount == 0)
        #expect(scenario.viewModel.sessionOperationTimeoutTask != nil)

        scenario.provider.completeSignIn(with: .failure(.unknown))
        await operation.value
        #expect(scenario.viewModel.sessionOperationState == .idle)
    }

    @Test("El timeout recupera la UI y bloquea nuevas sesiones hasta limpiar el proveedor tardío")
    func signInTimeoutFailsClosedUntilProviderDrains() async throws {
        let scenario = makeSessionTimeoutScenario()
        guard let operation = try await expireSignIn(in: scenario) else { return }
        let viewModel = scenario.viewModel
        let provider = scenario.provider

        #expect(viewModel.mode == .signedOut)
        #expect(viewModel.isAuthenticating == false)
        #expect(viewModel.isSessionOperationDraining)
        #expect(viewModel.sessionOperationTask != nil)
        #expect(viewModel.showSessionExpiredDialog == false)
        #expect(viewModel.showUnauthorizedDialog == false)
        #expect(viewModel.feedbackCenter.messageKey == AccessL10nKey.authErrorNetwork)
        #expect(provider.isAuthenticated == false)

        populateValidAccessDrafts(in: viewModel, member: scenario.member)
        #expect(viewModel.canSubmitSignIn == false)
        #expect(viewModel.canSubmitSignUp == false)
        viewModel.signIn()
        viewModel.signUp()
        viewModel.refreshSession(trigger: .startup)
        #expect(provider.signInRequestCount == 1)
        #expect(provider.signUpRequestCount == 0)
        #expect(provider.refreshRequestCount == 0)

        provider.completeSignIn(with: .success(scenario.principal))
        await operation.value
        #expect(viewModel.mode == .signedOut)
        #expect(viewModel.isSessionOperationDraining == false)
        #expect(viewModel.sessionOperationTask == nil)
        #expect(provider.isAuthenticated == false)
        #expect(provider.signOutCallCount == 2)

        viewModel.emailInput = scenario.member.normalizedEmail
        viewModel.passwordInput = "secret12"
        viewModel.signIn()
        guard await provider.waitForSignInRequestCount(2) else { return }
        try await scenario.sleeper.waitForRequestCount(2)
        guard let retry = viewModel.sessionOperationTask else {
            Issue.record("El reintento posterior al drenaje no tiene propietario")
            return
        }
        provider.completeSignIn(at: 1, with: .success(scenario.principal))
        await retry.value
        #expect(viewModel.mode.isAuthenticatedSession)
        #expect(provider.isAuthenticated)
    }

    @Test("El timeout de refresh expulsa la sesión sin diálogo y descarta el resultado tardío")
    func refreshTimeoutFailsClosedWithoutExpiredDialog() async throws {
        let scenario = makeSessionTimeoutScenario(isAuthenticated: true)
        scenario.viewModel.mode = timeoutAuthorizedMode(
            member: scenario.member,
            principal: scenario.principal
        )

        scenario.viewModel.refreshSession(trigger: .startup)
        guard await scenario.provider.waitForRefreshRequestCount(1) else { return }
        try await scenario.sleeper.waitForRequestCount(1)
        guard let operation = scenario.viewModel.sessionOperationTask,
              let timeout = scenario.viewModel.sessionOperationTimeoutTask else {
            Issue.record("El refresh no conserva las tareas de operación y timeout")
            return
        }
        await scenario.sleeper.completeRequest(at: 0)
        await timeout.value

        #expect(scenario.viewModel.mode == .signedOut)
        #expect(scenario.viewModel.isSessionRefreshInFlight == false)
        #expect(scenario.viewModel.isSessionOperationDraining)
        #expect(scenario.viewModel.showSessionExpiredDialog == false)
        #expect(scenario.viewModel.feedbackCenter.messageKey == AccessL10nKey.authErrorNetwork)

        scenario.provider.completeRefresh(with: .active(scenario.principal))
        await operation.value
        #expect(scenario.viewModel.mode == .signedOut)
        #expect(scenario.viewModel.isSessionOperationDraining == false)
        #expect(scenario.provider.isAuthenticated == false)
        #expect(scenario.provider.signOutCallCount == 2)
    }

    @Test("El alta comparte deadline y cuarentena con el resto del carril de sesión")
    func signUpTimeoutFailsClosedUntilProviderDrains() async throws {
        let scenario = makeSessionTimeoutScenario()
        let viewModel = scenario.viewModel
        viewModel.registerEmailInput = "new-member@example.com"
        viewModel.registerPasswordInput = "secret12"
        viewModel.registerRepeatPasswordInput = "secret12"

        viewModel.signUp()
        guard await scenario.provider.waitForSignUpRequestCount(1) else { return }
        try await scenario.sleeper.waitForRequestCount(1)
        #expect(await scenario.sleeper.requestedDuration(at: 0) == Duration.seconds(30))
        guard let operation = viewModel.sessionOperationTask,
              let timeout = viewModel.sessionOperationTimeoutTask else {
            Issue.record("El alta no conserva las tareas de operación y timeout")
            return
        }
        await scenario.sleeper.completeRequest(at: 0)
        await timeout.value
        #expect(viewModel.mode == .signedOut)
        #expect(viewModel.isRegistering == false)
        #expect(viewModel.isSessionOperationDraining)
        #expect(viewModel.canSubmitSignUp == false)

        scenario.provider.completeSignUp(
            with: .verificationRequired(
                email: "new-member@example.com",
                verificationSent: true,
                signedOut: false
            )
        )
        await operation.value
        #expect(viewModel.mode == .signedOut)
        #expect(viewModel.isSessionOperationDraining == false)
        #expect(scenario.provider.isAuthenticated == false)
        #expect(scenario.provider.signOutCallCount == 2)
    }

    @Test("Un cleanup definitivo fallido mantiene la sesión en cuarentena")
    func failedDefinitiveCleanupKeepsSessionDraining() async throws {
        let scenario = makeSessionTimeoutScenario(signOutResults: [true, false])
        guard let operation = try await expireSignIn(in: scenario) else { return }

        scenario.provider.completeSignIn(with: .success(scenario.principal))
        await operation.value

        #expect(
            scenario.viewModel.mode == .unauthorized(
                email: scenario.member.normalizedEmail,
                reason: .userAccessRestricted
            )
        )
        #expect(scenario.viewModel.isSessionOperationDraining)
        #expect(scenario.viewModel.sessionOperationTask != nil)
        #expect(scenario.viewModel.feedbackCenter.messageKey == AccessL10nKey.authErrorUnknown)
        #expect(scenario.provider.isAuthenticated)
        #expect(scenario.provider.signOutCallCount == 2)

        populateValidAccessDrafts(in: scenario.viewModel, member: scenario.member)
        scenario.viewModel.signIn()
        #expect(scenario.viewModel.canSubmitSignIn == false)
        #expect(scenario.provider.signInRequestCount == 1)
    }

    @Test("El timeout de alta conserva el email registrado si falla el cleanup")
    func signUpCleanupFailureUsesRegistrationEmail() async throws {
        let scenario = makeSessionTimeoutScenario(signOutResults: [true, false])
        let registrationEmail = "new-member@example.com"
        scenario.viewModel.registerEmailInput = registrationEmail
        scenario.viewModel.registerPasswordInput = "secret12"
        scenario.viewModel.registerRepeatPasswordInput = "secret12"

        scenario.viewModel.signUp()
        guard await scenario.provider.waitForSignUpRequestCount(1) else { return }
        try await scenario.sleeper.waitForRequestCount(1)
        guard let operation = scenario.viewModel.sessionOperationTask,
              let timeout = scenario.viewModel.sessionOperationTimeoutTask else {
            Issue.record("El alta no conserva sus tareas de timeout")
            return
        }
        await scenario.sleeper.completeRequest(at: 0)
        await timeout.value
        scenario.provider.completeSignUp(
            with: .verificationRequired(
                email: registrationEmail,
                verificationSent: true,
                signedOut: false
            )
        )
        await operation.value

        #expect(
            scenario.viewModel.mode == .unauthorized(
                email: registrationEmail,
                reason: .userAccessRestricted
            )
        )
        #expect(scenario.viewModel.isSessionOperationDraining)
        #expect(scenario.viewModel.feedbackCenter.messageKey == AccessL10nKey.authErrorUnknown)
        #expect(scenario.provider.signOutCallCount == 2)
    }

}

struct SessionTimeoutScenario {
    let member: Member
    let principal: AuthPrincipal
    let provider: ControlledSessionAuthProvider
    let sleeper: ControlledSessionOperationSleeper
    let viewModel: SessionViewModel
}

@MainActor
func makeSessionTimeoutScenario(
    isAuthenticated: Bool = false,
    signOutResults: [Bool] = [],
    authorizedDeviceRegistrar: any AuthorizedDeviceRegistrar = NoOpAuthorizedDeviceRegistrar(),
    criticalDataFreshnessLocalRepository: any CriticalDataFreshnessLocalRepository =
        NoOpCriticalDataFreshnessLocalRepository()
) -> SessionTimeoutScenario {
    let member = timeoutMember()
    let principal = AuthPrincipal(
        uid: member.authUid ?? "",
        email: member.normalizedEmail
    )
    let provider = ControlledSessionAuthProvider(
        isAuthenticated: isAuthenticated,
        signOutResults: signOutResults
    )
    let sleeper = ControlledSessionOperationSleeper()
    let repository = TimeoutSessionMemberRepository(member: member)
    let environmentRouter = FixedSessionEnvironmentRouter()
    let viewModel = SessionViewModel(
        repository: repository,
        authSessionProvider: provider,
        resolveAuthorizedSession: ResolveAuthorizedSessionUseCase(
            repository: repository,
            resolver: TimeoutAuthorizedMemberResolver(member: member),
            environmentRouter: environmentRouter
        ),
        authorizedDeviceRegistrar: authorizedDeviceRegistrar,
        criticalDataFreshnessLocalRepository: criticalDataFreshnessLocalRepository,
        environmentRouter: environmentRouter,
        sessionRefreshPolicy: SessionRefreshPolicy(minimumForegroundIntervalMillis: 0),
        nowMillisProvider: { 1_000 },
        sessionOperationTimeout: .seconds(30),
        sessionOperationSleeper: { try await sleeper.sleep(for: $0) }
    )
    return SessionTimeoutScenario(
        member: member,
        principal: principal,
        provider: provider,
        sleeper: sleeper,
        viewModel: viewModel
    )
}

@MainActor private func expireSignIn(in scenario: SessionTimeoutScenario) async throws -> Task<Void, Never>? {
    scenario.viewModel.emailInput = scenario.member.normalizedEmail
    scenario.viewModel.passwordInput = "secret12"
    scenario.viewModel.signIn()
    guard await scenario.provider.waitForSignInRequestCount(1) else { return nil }
    try await scenario.sleeper.waitForRequestCount(1)
    #expect(await scenario.sleeper.requestedDuration(at: 0) == Duration.seconds(30))
    guard let operation = scenario.viewModel.sessionOperationTask,
          let timeout = scenario.viewModel.sessionOperationTimeoutTask else {
        Issue.record("El login no conserva las tareas de operación y timeout")
        return nil
    }
    await scenario.sleeper.completeRequest(at: 0)
    await timeout.value
    return operation
}

@MainActor private func populateValidAccessDrafts(in viewModel: SessionViewModel, member: Member) {
    viewModel.emailInput = member.normalizedEmail
    viewModel.passwordInput = "new-secret12"
    viewModel.registerEmailInput = "new-member@example.com"
    viewModel.registerPasswordInput = "new-secret12"
    viewModel.registerRepeatPasswordInput = "new-secret12"
}

@MainActor private func timeoutMember() -> Member {
    Member(
        id: "timeout_member",
        displayName: "Timeout Member",
        normalizedEmail: "timeout@example.com",
        authUid: "timeout_auth",
        roles: [.member],
        isActive: true,
        producerCatalogEnabled: true
    )
}

func timeoutAuthorizedMode(member: Member, principal: AuthPrincipal) -> SessionMode {
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

nonisolated private struct TimeoutAuthorizedMemberResolver: AuthorizedMemberResolving {
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

nonisolated private struct TimeoutSessionMemberRepository: MemberRepository {
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

actor ControlledSessionOperationSleeper {
    private var nextRequestIndex = 0
    private var registeredRequestCount = 0
    private var requestedDurations: [Duration] = []
    private var requestContinuations: [Int: CheckedContinuation<Void, any Error>] = [:]
    private var requestCountWaiters: [Int: (count: Int, continuation: CheckedContinuation<Void, any Error>)] = [:]
    private var nextRequestCountWaiterID = 0
    private var cancelledRequests: Set<Int> = []

    func sleep(for duration: Duration) async throws {
        let requestIndex = nextRequestIndex
        nextRequestIndex += 1
        requestedDurations.append(duration)
        try await withTaskCancellationHandler {
            try Task.checkCancellation()
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, any Error>) in
                if cancelledRequests.remove(requestIndex) != nil {
                    continuation.resume(throwing: CancellationError())
                } else {
                    requestContinuations[requestIndex] = continuation
                    registeredRequestCount += 1
                    resumeSatisfiedRequestCountWaiters()
                }
            }
        } onCancel: {
            Task { await self.cancelRequest(at: requestIndex) }
        }
    }

    func waitForRequestCount(_ expectedCount: Int) async throws {
        if registeredRequestCount >= expectedCount {
            return
        }

        let waiterID = nextRequestCountWaiterID
        nextRequestCountWaiterID += 1
        try await withTaskCancellationHandler {
            try Task.checkCancellation()
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, any Error>) in
                guard !Task.isCancelled else {
                    continuation.resume(throwing: CancellationError())
                    return
                }
                requestCountWaiters[waiterID] = (expectedCount, continuation)
            }
        } onCancel: {
            Task {
                await self.cancelRequestCountWaiter(id: waiterID)
            }
        }
    }

    func completeRequest(at index: Int) {
        guard let continuation = requestContinuations.removeValue(forKey: index) else {
            Issue.record("No existe el timeout de sesión número \(index)")
            return
        }
        continuation.resume()
    }

    func requestedDuration(at index: Int) -> Duration? {
        requestedDurations.indices.contains(index) ? requestedDurations[index] : nil
    }

    private func cancelRequest(at index: Int) {
        guard let continuation = requestContinuations.removeValue(forKey: index) else {
            cancelledRequests.insert(index)
            return
        }
        continuation.resume(throwing: CancellationError())
    }

    private func resumeSatisfiedRequestCountWaiters() {
        let satisfiedIDs = requestCountWaiters.compactMap { id, waiter in
            registeredRequestCount >= waiter.count ? id : nil
        }
        for id in satisfiedIDs {
            requestCountWaiters.removeValue(forKey: id)?.continuation.resume()
        }
    }

    private func cancelRequestCountWaiter(id: Int) {
        requestCountWaiters.removeValue(forKey: id)?.continuation.resume(throwing: CancellationError())
    }

}
