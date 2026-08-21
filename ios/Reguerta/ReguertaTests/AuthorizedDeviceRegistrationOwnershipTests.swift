import Testing

@testable import Reguerta

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct AuthorizedDeviceRegistrationOwnershipTests {
    @Test("El registro suspendido no retiene el carril ni el deadline de autenticación")
    func suspendedRegistrationReleasesAuthenticationLaneAndDeadline() async throws {
        let scenario = makeAuthorizedDeviceRegistrationOwnershipScenario()
        defer { scenario.registrar.cancelAll() }
        scenario.viewModel.emailInput = scenario.member.normalizedEmail
        scenario.viewModel.passwordInput = "secret12"

        scenario.viewModel.signIn()
        guard await scenario.provider.waitForSignInRequestCount(1) else { return }
        try await scenario.sleeper.waitForRequestCount(1)
        guard let authenticationOperation = scenario.viewModel.sessionOperationTask else {
            Issue.record("La autenticación no conservó su propietario")
            return
        }
        scenario.provider.completeSignIn(with: .success(scenario.principal))
        try await scenario.registrar.waitForRegistrationCount(1)

        #expect(scenario.viewModel.mode.isAuthenticatedSession)
        #expect(scenario.viewModel.sessionOperationState == .idle)
        #expect(scenario.viewModel.sessionOperationTask == nil)
        #expect(scenario.viewModel.sessionOperationTimeoutTask == nil)
        #expect(scenario.viewModel.isAuthenticating == false)

        scenario.viewModel.signOut()
        try await scenario.registrar.waitForClearCount(1)
        scenario.registrar.releaseRegistration(at: 0)
        scenario.registrar.releaseClear(at: 0)
        await authenticationOperation.value
        if let cleanup = scenario.viewModel.sessionOperationTask {
            await cleanup.value
        }
    }

    @Test("El registro completado conserva un fence de sesión persistente")
    func completedRegistrationKeepsPersistentSessionFence() async throws {
        let scenario = makeAuthorizedDeviceRegistrationOwnershipScenario(isAuthenticated: true)
        defer { scenario.registrar.cancelAll() }
        let authorization = Task { @MainActor in
            await authorizeDeviceRegistrationOwnershipScenario(scenario)
        }
        try await scenario.registrar.waitForRegistrationCount(1)
        let registration = try #require(scenario.viewModel.authorizedDeviceRegistrationTask)

        scenario.registrar.releaseRegistration(at: 0)
        try await scenario.registrar.waitForRegistrationReturnCount(1)
        await registration.value
        await authorization.value

        #expect(scenario.viewModel.authorizedDeviceRegistrationTask == nil)
        #expect(await scenario.registrar.isSessionCurrent(forRegistrationAt: 0))

        scenario.viewModel.signOut()
        try await scenario.registrar.waitForClearCount(1)
        scenario.registrar.releaseClear(at: 0)
        if let cleanup = scenario.viewModel.sessionOperationTask {
            await cleanup.value
        }
    }

    @Test("El refresh benigno mantiene el fence anterior hasta publicar su reemplazo")
    func benignRefreshKeepsPreviousFenceUntilReplacement() async throws {
        let scenario = makeAuthorizedDeviceRegistrationOwnershipScenario(isAuthenticated: true)
        defer { scenario.registrar.cancelAll() }
        let initialAuthorization = Task { @MainActor in
            await authorizeDeviceRegistrationOwnershipScenario(scenario)
        }
        try await scenario.registrar.waitForRegistrationCount(1)
        let initialRegistration = try #require(scenario.viewModel.authorizedDeviceRegistrationTask)
        scenario.registrar.releaseRegistration(at: 0)
        try await scenario.registrar.waitForRegistrationReturnCount(1)
        await initialRegistration.value
        await initialAuthorization.value
        #expect(scenario.viewModel.authorizedDeviceRegistrationTask == nil)

        scenario.viewModel.refreshSession(trigger: .startup)
        guard await scenario.provider.waitForRefreshRequestCount(1) else { return }
        try await scenario.sleeper.waitForRequestCount(1)
        guard let refreshOperation = scenario.viewModel.sessionOperationTask else {
            Issue.record("El refresh no conservó su propietario")
            return
        }

        #expect(await scenario.registrar.isSessionCurrent(forRegistrationAt: 0))

        scenario.provider.completeRefresh(with: .active(scenario.principal))
        try await scenario.registrar.waitForRegistrationCount(2)

        #expect(await scenario.registrar.isSessionCurrent(forRegistrationAt: 0) == false)
        #expect(await scenario.registrar.isSessionCurrent(forRegistrationAt: 1))

        scenario.registrar.releaseRegistration(at: 1)
        await refreshOperation.value
        scenario.viewModel.signOut()
        try await scenario.registrar.waitForClearCount(1)
        scenario.registrar.releaseClear(at: 0)
        if let cleanup = scenario.viewModel.sessionOperationTask {
            await cleanup.value
        }
    }

    @Test("Logout invalida y cancela el registro antes de limpiar el lease")
    func logoutInvalidatesAndCancelsRegistrationBeforeLeaseCleanup() async throws {
        let scenario = makeAuthorizedDeviceRegistrationOwnershipScenario(isAuthenticated: true)
        defer { scenario.registrar.cancelAll() }
        let authorization = Task { @MainActor in
            await authorizeDeviceRegistrationOwnershipScenario(scenario)
        }
        try await scenario.registrar.waitForRegistrationCount(1)

        scenario.viewModel.signOut()
        try await scenario.registrar.waitForClearCount(1)

        #expect(scenario.registrar.cancellationWasObservedBeforeClear(at: 0))
        #expect(scenario.registrar.sessionWasCurrentAtClearEntry(at: 0) == false)

        scenario.registrar.releaseRegistration(at: 0)
        scenario.registrar.releaseClear(at: 0)
        await authorization.value
        if let cleanup = scenario.viewModel.sessionOperationTask {
            await cleanup.value
        }
    }

    @Test("La finalización tardía no puede desposeer al registro de un relogin")
    func lateCompletionCannotClobberReloginSuccessor() async throws {
        let scenario = makeAuthorizedDeviceRegistrationOwnershipScenario(isAuthenticated: true)
        defer { scenario.registrar.cancelAll() }
        let initialAuthorization = Task { @MainActor in
            await authorizeDeviceRegistrationOwnershipScenario(scenario)
        }
        try await scenario.registrar.waitForRegistrationCount(1)
        let staleRegistration = try #require(scenario.viewModel.authorizedDeviceRegistrationTask)

        scenario.viewModel.signOut()
        try await scenario.registrar.waitForClearCount(1)
        scenario.registrar.releaseClear(at: 0)
        if let cleanup = scenario.viewModel.sessionOperationTask {
            await cleanup.value
        }

        let successorAuthorization = Task { @MainActor in
            await authorizeDeviceRegistrationOwnershipScenario(scenario)
        }
        try await scenario.registrar.waitForRegistrationCount(2)
        let successorRegistration = try #require(scenario.viewModel.authorizedDeviceRegistrationTask)

        scenario.registrar.releaseRegistration(at: 0)
        await staleRegistration.value

        #expect(await scenario.registrar.isSessionCurrent(forRegistrationAt: 0) == false)
        #expect(await scenario.registrar.isSessionCurrent(forRegistrationAt: 1))
        #expect(scenario.viewModel.authorizedDeviceRegistrationTask != nil)

        scenario.viewModel.signOut()
        try await scenario.registrar.waitForClearCount(2)

        #expect(scenario.registrar.cancellationWasObservedBeforeClear(at: 1))
        #expect(scenario.registrar.sessionWasCurrentAtClearEntry(at: 1) == false)

        scenario.registrar.releaseRegistration(at: 1)
        scenario.registrar.releaseClear(at: 1)
        await initialAuthorization.value
        await successorAuthorization.value
        await successorRegistration.value
        if let cleanup = scenario.viewModel.sessionOperationTask {
            await cleanup.value
        }
    }

    @Test("El fence rechaza drift de comando y lease aunque la revision no cambie")
    func sessionFenceRejectsCommandAndLeaseDriftAtTheSameRevision() async throws {
        let scenario = makeAuthorizedDeviceRegistrationOwnershipScenario(isAuthenticated: true)
        defer { scenario.registrar.cancelAll() }
        let authorization = Task { @MainActor in
            await authorizeDeviceRegistrationOwnershipScenario(scenario)
        }
        try await scenario.registrar.waitForRegistrationCount(1)
        let registration = try #require(scenario.viewModel.authorizedDeviceRegistrationTask)
        let registrationRevision = scenario.viewModel.authorizedDeviceRegistrationRevision
        let deviceLease = try #require(scenario.viewModel.authorizedDeviceSessionLease)
        guard case .authorized(let authorizedSession) = scenario.viewModel.mode else {
            Issue.record("La sesion inicial no quedo autorizada")
            return
        }

        #expect(await scenario.registrar.isSessionCurrent(forRegistrationAt: 0))
        await expectModeAndIdentityDriftRejected(
            scenario: scenario,
            authorizedSession: authorizedSession,
            registrationRevision: registrationRevision
        )
        await expectEnvironmentAndLeaseDriftRejected(
            scenario: scenario,
            authorizedSession: authorizedSession,
            registrationRevision: registrationRevision,
            deviceLease: deviceLease
        )

        scenario.registrar.releaseRegistration(at: 0)
        await registration.value
        await authorization.value
        scenario.viewModel.signOut()
        try await scenario.registrar.waitForClearCount(1)
        scenario.registrar.releaseClear(at: 0)
        if let cleanup = scenario.viewModel.sessionOperationTask {
            await cleanup.value
        }
    }

    private func expectModeAndIdentityDriftRejected(
        scenario: AuthorizedDeviceRegistrationOwnershipScenario,
        authorizedSession: AuthorizedSession,
        registrationRevision: UInt64
    ) async {
        scenario.viewModel.mode = .signedOut
        #expect(scenario.viewModel.authorizedDeviceRegistrationRevision == registrationRevision)
        #expect(await scenario.registrar.isSessionCurrent(forRegistrationAt: 0) == false)

        let inactiveMember = replacingDeviceRegistrationOwnershipActiveState(
            in: authorizedSession.authenticatedMember,
            isActive: false
        )
        scenario.viewModel.mode = .authorized(
            AuthorizedSession(
                principal: authorizedSession.principal,
                authenticatedMember: inactiveMember,
                member: inactiveMember,
                members: [inactiveMember],
                environment: authorizedSession.environment
            )
        )
        #expect(scenario.viewModel.authorizedDeviceRegistrationRevision == registrationRevision)
        #expect(await scenario.registrar.isSessionCurrent(forRegistrationAt: 0) == false)

        await expectMemberIdentifierDriftRejected(
            scenario: scenario,
            authorizedSession: authorizedSession,
            registrationRevision: registrationRevision
        )

        scenario.viewModel.mode = .authorized(
            AuthorizedSession(
                principal: AuthPrincipal(uid: "drifted_auth_uid", email: authorizedSession.principal.email),
                authenticatedMember: authorizedSession.authenticatedMember,
                member: authorizedSession.member,
                members: authorizedSession.members,
                environment: authorizedSession.environment
            )
        )
        #expect(scenario.viewModel.authorizedDeviceRegistrationRevision == registrationRevision)
        #expect(await scenario.registrar.isSessionCurrent(forRegistrationAt: 0) == false)

        scenario.viewModel.mode = .authorized(authorizedSession)
        #expect(await scenario.registrar.isSessionCurrent(forRegistrationAt: 0))
    }

    private func expectMemberIdentifierDriftRejected(
        scenario: AuthorizedDeviceRegistrationOwnershipScenario,
        authorizedSession: AuthorizedSession,
        registrationRevision: UInt64
    ) async {
        let mismatchedMember = replacingDeviceRegistrationOwnershipID(
            in: authorizedSession.authenticatedMember,
            id: "drifted_member_id"
        )
        #expect(mismatchedMember.authUid == authorizedSession.authenticatedMember.authUid)
        #expect(mismatchedMember.roles == authorizedSession.authenticatedMember.roles)
        scenario.viewModel.mode = .authorized(
            AuthorizedSession(
                principal: authorizedSession.principal,
                authenticatedMember: mismatchedMember,
                member: mismatchedMember,
                members: [mismatchedMember],
                environment: authorizedSession.environment
            )
        )
        #expect(scenario.viewModel.authorizedDeviceRegistrationRevision == registrationRevision)
        #expect(await scenario.registrar.isSessionCurrent(forRegistrationAt: 0) == false)

        scenario.viewModel.mode = .authorized(authorizedSession)
        #expect(scenario.viewModel.authorizedDeviceRegistrationRevision == registrationRevision)
        #expect(await scenario.registrar.isSessionCurrent(forRegistrationAt: 0))
    }

    private func expectEnvironmentAndLeaseDriftRejected(
        scenario: AuthorizedDeviceRegistrationOwnershipScenario,
        authorizedSession: AuthorizedSession,
        registrationRevision: UInt64,
        deviceLease: AuthorizedDeviceSessionLease
    ) async {
        scenario.viewModel.mode = .authorized(
            AuthorizedSession(
                principal: authorizedSession.principal,
                authenticatedMember: authorizedSession.authenticatedMember,
                member: authorizedSession.member,
                members: authorizedSession.members,
                environment: .production
            )
        )
        #expect(scenario.viewModel.authorizedDeviceRegistrationRevision == registrationRevision)
        #expect(await scenario.registrar.isSessionCurrent(forRegistrationAt: 0) == false)

        scenario.viewModel.mode = .authorized(authorizedSession)
        #expect(await scenario.registrar.isSessionCurrent(forRegistrationAt: 0))

        scenario.viewModel.authorizedDeviceSessionLease = AuthorizedDeviceSessionLease()
        #expect(scenario.viewModel.authorizedDeviceRegistrationRevision == registrationRevision)
        #expect(await scenario.registrar.isSessionCurrent(forRegistrationAt: 0) == false)

        scenario.viewModel.authorizedDeviceSessionLease = deviceLease
        #expect(await scenario.registrar.isSessionCurrent(forRegistrationAt: 0))
    }
}
