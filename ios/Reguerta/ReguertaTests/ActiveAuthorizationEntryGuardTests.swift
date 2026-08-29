import Testing

@testable import Reguerta

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct ActiveAuthorizationEntryGuardTests {
    @Test("La autorizacion activa exige enlace, miembros activos y delegacion administrativa")
    func canonicalAuthorizationGuardCoversEveryRequiredInvariant() {
        let authenticatedMember = activeEntryMember(id: "auth_member", authUID: "principal")
        let selectedMember = activeEntryMember(id: "selected_member", authUID: nil)
        let admin = activeEntryMember(id: "admin", authUID: "admin_principal", roles: [.member, .admin])

        #expect(activeEntrySession(
            principalUID: "principal",
            authenticatedMember: authenticatedMember
        ).representsActiveAuthorization)
        #expect(!activeEntrySession(
            principalUID: "other",
            authenticatedMember: authenticatedMember
        ).representsActiveAuthorization)
        #expect(!activeEntrySession(
            principalUID: "principal",
            authenticatedMember: activeEntryInactiveCopy(of: authenticatedMember)
        ).representsActiveAuthorization)
        #expect(!activeEntrySession(
            principalUID: "principal",
            authenticatedMember: authenticatedMember,
            selectedMember: activeEntryInactiveCopy(of: selectedMember)
        ).representsActiveAuthorization)
        #expect(!activeEntrySession(
            principalUID: "principal",
            authenticatedMember: authenticatedMember,
            selectedMember: selectedMember
        ).representsActiveAuthorization)
        #expect(activeEntrySession(
            principalUID: "admin_principal",
            authenticatedMember: admin,
            selectedMember: selectedMember
        ).representsActiveAuthorization)
    }

    @Test("Products no lee tras reflejarse una revocacion sin handler de ruta")
    func productsLoadDoesNotReachRepositoryAfterUnobservedRevocation() async {
        let currentMember = producer(id: "revoked_product_owner", parity: .even)
        let repository = ControlledProductRepository(items: [], rejectsReads: false)
        let viewModel = await makeProductsViewModel(
            currentMember: currentMember,
            members: [currentMember],
            productRepository: repository
        )
        let session = viewModel.sessionViewModel.mode.activeEntryAuthorizedSession

        viewModel.sessionViewModel.mode = activeEntryRevokedMode(from: session)
        await viewModel.refreshCatalog()

        #expect(repository.readCount == 0)
        #expect(!viewModel.isLoadingCatalog)
    }

    @Test("Shifts no envia una planificacion tras reflejarse una revocacion sin handler de ruta")
    func shiftPlanningDoesNotReachRepositoryAfterUnobservedRevocation() async {
        let currentMember = adminMember(id: "revoked_shift_admin", displayName: "Admin")
        let repository = RecordingShiftPlanningRequestRepository()
        let viewModel = makeShiftsViewModel(
            currentMember: currentMember,
            members: [currentMember],
            shiftPlanningRequestRepository: repository
        )
        viewModel.shiftPlanningDeliverySeasonInput = "2026"
        viewModel.shiftPlanningMarketSeasonInput = "2027"
        viewModel.requestShiftPlanningPreview()
        let session = viewModel.sessionViewModel.mode.activeEntryAuthorizedSession

        viewModel.sessionViewModel.mode = activeEntryRevokedMode(from: session)
        await viewModel.confirmShiftPlanningRequest()

        #expect(await repository.submittedRequests().isEmpty)
        #expect(!viewModel.isSubmittingShiftPlanningRequest)
    }

    @Test("Freshness no inicia retry ni revalidacion con una autorizacion ya revocada")
    func freshnessEntryOperationsDoNotReachRepositoryAfterUnobservedRevocation() async {
        let scenario = activeEntryFreshnessScenario()
        let revokedMode = activeEntryRevokedMode(from: scenario.session)
        scenario.sessionViewModel.mode = revokedMode
        guard case .authorized(let revokedSession) = revokedMode else {
            Issue.record("Expected an authorized revoked session")
            return
        }
        let revokedContext = MyOrderFreshnessSessionContext(
            session: revokedSession,
            sessionStateRevision: scenario.sessionViewModel.sessionStateRevision
        )

        scenario.viewModel.retry(currentMode: scenario.sessionViewModel.mode)
        let canEnter = await scenario.viewModel.revalidateForEntry(context: revokedContext)

        #expect(!canEnter)
        #expect(await scenario.remoteRepository.requestCount() == 0)
        #expect(scenario.viewModel.freshnessOperationTask == nil)
        #expect(scenario.viewModel.freshnessTimeoutTask == nil)
    }

    @Test("Freshness cancela la entrada del retry automatico si la revision ya fue revocada")
    func freshnessAutomaticRetryDoesNotReachRepositoryAfterUnobservedRevocation() async throws {
        let timeoutSleeper = ControlledFreshnessSleeper()
        let retrySleeper = ControlledFreshnessSleeper()
        let scenario = activeEntryFreshnessScenario(
            timeoutSleeper: timeoutSleeper,
            automaticRetrySleeper: retrySleeper
        )
        scenario.viewModel.retry(currentMode: .authorized(scenario.session))
        let initialTasks = try #require(ownedRefreshTasks(in: scenario.viewModel))
        defer {
            initialTasks.operation.cancel()
            initialTasks.timeout.cancel()
        }
        try await scenario.remoteRepository.waitForRequestCount(1)
        await scenario.remoteRepository.completeRequest(at: 0, with: invalidConcurrencyFreshnessConfig())
        await initialTasks.operation.value
        await initialTasks.timeout.value
        try await retrySleeper.waitForRequestCount(1)
        let retryTask = try #require(scenario.viewModel.freshnessRetryTask)

        scenario.sessionViewModel.mode = activeEntryRevokedMode(from: scenario.session)
        await retrySleeper.completeRequest(at: 0)
        await retryTask.value

        #expect(await scenario.remoteRepository.requestCount() == 1)
        #expect(scenario.viewModel.freshnessRetryTask == nil)
    }
}

private struct ActiveEntryFreshnessScenario {
    let sessionViewModel: SessionViewModel
    let session: AuthorizedSession
    let remoteRepository: ControlledCriticalDataFreshnessRemoteRepository
    let viewModel: MyOrderFreshnessViewModel
}

@MainActor
private func activeEntryFreshnessScenario(
    timeoutSleeper: ControlledFreshnessSleeper? = nil,
    automaticRetrySleeper: ControlledFreshnessSleeper? = nil
) -> ActiveEntryFreshnessScenario {
    let sessionViewModel = SessionViewModel(dependencies: .preview())
    let authenticatedMember = activeEntryMember(id: "freshness_member", authUID: "freshness_principal")
    let session = activeEntrySession(
        principalUID: "freshness_principal",
        authenticatedMember: authenticatedMember
    )
    sessionViewModel.mode = .authorized(session)
    let remoteRepository = ControlledCriticalDataFreshnessRemoteRepository()
    let localRepository = InMemoryCriticalDataFreshnessLocalRepository()
    let viewModel = MyOrderFreshnessViewModel(
        resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase(
            remoteRepository: remoteRepository,
            localRepository: localRepository,
            nowProvider: { 2_000 }
        ),
        criticalDataFreshnessLocalRepository: localRepository,
        sessionStateRevisionProvider: { sessionViewModel.sessionStateRevision },
        timeout: .seconds(60),
        automaticRetryDelays: automaticRetrySleeper == nil ? [] : [.seconds(1)],
        sleeper: { duration in
            if let timeoutSleeper {
                try await timeoutSleeper.sleep(for: duration)
            }
        },
        automaticRetrySleeper: { duration in
            if let automaticRetrySleeper {
                try await automaticRetrySleeper.sleep(for: duration)
            }
        }
    )
    return ActiveEntryFreshnessScenario(
        sessionViewModel: sessionViewModel,
        session: session,
        remoteRepository: remoteRepository,
        viewModel: viewModel
    )
}

private extension SessionMode {
    var activeEntryAuthorizedSession: AuthorizedSession {
        guard case .authorized(let session) = self else {
            preconditionFailure("Expected an authorized test session")
        }
        return session
    }
}

private func activeEntrySession(
    principalUID: String,
    authenticatedMember: Member,
    selectedMember: Member? = nil
) -> AuthorizedSession {
    let selectedMember = selectedMember ?? authenticatedMember
    return AuthorizedSession(
        principal: AuthPrincipal(uid: principalUID, email: authenticatedMember.normalizedEmail),
        authenticatedMember: authenticatedMember,
        member: selectedMember,
        members: [authenticatedMember, selectedMember],
        environment: .develop
    )
}

private func activeEntryRevokedMode(from session: AuthorizedSession) -> SessionMode {
    let inactiveAuthenticatedMember = activeEntryInactiveCopy(of: session.authenticatedMember)
    let inactiveSelectedMember = session.member.id == session.authenticatedMember.id
        ? inactiveAuthenticatedMember
        : activeEntryInactiveCopy(of: session.member)
    return .authorized(AuthorizedSession(
        principal: session.principal,
        authenticatedMember: inactiveAuthenticatedMember,
        member: inactiveSelectedMember,
        members: [inactiveAuthenticatedMember, inactiveSelectedMember],
        environment: session.environment
    ))
}

private func activeEntryMember(
    id: String,
    authUID: String?,
    roles: Set<MemberRole> = [.member],
    isActive: Bool = true
) -> Member {
    Member(
        id: id,
        displayName: id,
        normalizedEmail: "\(id)@reguerta.test",
        authUid: authUID,
        roles: roles,
        isActive: isActive,
        producerCatalogEnabled: true
    )
}

private func activeEntryInactiveCopy(of member: Member) -> Member {
    Member(
        id: member.id,
        displayName: member.displayName,
        companyName: member.companyName,
        phoneNumber: member.phoneNumber,
        normalizedEmail: member.normalizedEmail,
        authUid: member.authUid,
        roles: member.roles,
        isActive: false,
        producerCatalogEnabled: member.producerCatalogEnabled,
        isCommonPurchaseManager: member.isCommonPurchaseManager,
        producerParity: member.producerParity,
        ecoCommitmentMode: member.ecoCommitmentMode,
        ecoCommitmentParity: member.ecoCommitmentParity
    )
}
