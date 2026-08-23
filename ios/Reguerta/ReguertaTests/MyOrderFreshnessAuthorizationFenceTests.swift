import Testing

@testable import Reguerta

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct MyOrderFreshnessAuthorizationFenceTests {
    @Test("Un cambio benigno de nombre conserva la entrada tras avanzar la revision")
    func benignMemberRevisionHandoffPreservesReadyEntry() async throws {
        let originalMember = member(id: "freshness_profile_update", ecoCommitmentMode: .weekly)
        let refreshedMember = replacingDisplayName(in: originalMember, with: "Nombre actualizado")
        let productsViewModel = await makeProductsViewModel(
            currentMember: originalMember,
            members: [originalMember],
            productRepository: InMemoryProductRepository()
        )
        let localRepository = InMemoryCriticalDataFreshnessLocalRepository()
        let refresher = CountingAuthorizationFreshnessRefresher(
            payload: CriticalDataRefreshPayload(
                authenticatedMember: refreshedMember,
                selectedMember: refreshedMember,
                members: [refreshedMember],
                products: [],
                seasonalCommitments: []
            )
        )
        let freshnessViewModel = makeAuthorizationFencedFreshnessViewModel(
            productsViewModel: productsViewModel,
            localRepository: localRepository,
            refresher: refresher,
            timeoutSleeper: nil
        )
        let originalSession = try #require(productsViewModel.sessionViewModel.mode.authorizedSession)
        let originalRevision = productsViewModel.sessionViewModel.sessionStateRevision
        let entryContext = MyOrderFreshnessSessionContext(
            session: originalSession,
            sessionStateRevision: originalRevision
        )

        let canEnter = await freshnessViewModel.revalidateForEntry(context: entryContext)

        let refreshedSession = try #require(productsViewModel.sessionViewModel.mode.authorizedSession)
        let refreshedRevision = productsViewModel.sessionViewModel.sessionStateRevision
        let refreshedContext = MyOrderFreshnessSessionContext(
            session: refreshedSession,
            sessionStateRevision: refreshedRevision
        )
        let refreshRequestCount = await refresher.requestCount
        #expect(canEnter)
        #expect(freshnessViewModel.state == .ready)
        #expect(refreshedRevision == originalRevision &+ 1)
        #expect(refreshedSession.principal == originalSession.principal)
        #expect(refreshedSession.member.displayName == refreshedMember.displayName)
        #expect(refreshedContext.authenticatedMember == entryContext.authenticatedMember)
        #expect(refreshedContext.member == entryContext.member)
        #expect(refreshedContext.environment == entryContext.environment)
        #expect(refreshRequestCount == 1)
        #expect(productsViewModel.isOrderingStateCurrentForFreshness(context: entryContext))
    }

    @Test("Un predicado current sin ACK explicito no legitima una revision sucesora")
    func currentPredicateAloneCannotAcknowledgeASuccessorRevision() async throws {
        let originalMember = member(id: "freshness_no_ack", ecoCommitmentMode: .weekly)
        let refreshedMember = replacingDisplayName(in: originalMember, with: "Sin ACK")
        let productsViewModel = await makeProductsViewModel(
            currentMember: originalMember,
            members: [originalMember],
            productRepository: InMemoryProductRepository()
        )
        let localRepository = InMemoryCriticalDataFreshnessLocalRepository()
        let freshnessViewModel = makeAuthorizationFencedFreshnessViewModel(
            productsViewModel: productsViewModel,
            localRepository: localRepository,
            refresher: CountingAuthorizationFreshnessRefresher(
                payload: CriticalDataRefreshPayload(
                    authenticatedMember: refreshedMember,
                    selectedMember: refreshedMember,
                    members: [refreshedMember],
                    products: [],
                    seasonalCommitments: []
                )
            ),
            timeoutSleeper: nil,
            acknowledgesSuccessorRevision: false
        )
        let originalSession = try #require(productsViewModel.sessionViewModel.mode.authorizedSession)
        let entryContext = MyOrderFreshnessSessionContext(
            session: originalSession,
            sessionStateRevision: productsViewModel.sessionViewModel.sessionStateRevision
        )

        let canEnter = await freshnessViewModel.revalidateForEntry(context: entryContext)

        #expect(!canEnter)
        #expect(freshnessViewModel.state == .unavailable)
        #expect(productsViewModel.isOrderingStateCurrentForFreshness(context: entryContext))
    }

    @Test("Una desactivacion live impide aplicar y reconocer un payload suspendido")
    func liveDeactivationFencesSuspendedFreshnessPayloadWithoutRouteHandler() async throws {
        let scenario = await makeFreshnessAuthorizationFenceScenario()
        let originalMode = scenario.productsViewModel.sessionViewModel.mode

        scenario.freshnessViewModel.retry(currentMode: originalMode)
        let tasks = try #require(ownedRefreshTasks(in: scenario.freshnessViewModel))
        defer {
            tasks.operation.cancel()
            tasks.timeout.cancel()
            scenario.refresher.cancelAll()
        }
        try await scenario.refresher.waitUntilStarted()

        let inactiveMember = replacingFreshnessActiveState(in: scenario.activeMember, with: false)
        let originalRevision = scenario.productsViewModel.sessionViewModel.sessionStateRevision
        scenario.productsViewModel.sessionViewModel.applyUpdatedAuthorizedMember(
            inactiveMember,
            members: [inactiveMember]
        )
        #expect(scenario.productsViewModel.sessionViewModel.sessionStateRevision != originalRevision)

        scenario.refresher.complete()
        await tasks.operation.value

        let currentSession = try #require(scenario.productsViewModel.sessionViewModel.mode.authorizedSession)
        #expect(!currentSession.authenticatedMember.isActive)
        #expect(!currentSession.member.isActive)
        #expect(scenario.productsViewModel.myOrderProducts == scenario.originalProducts)
        #expect(!scenario.productsViewModel.hasLoadedOrderingProducts)
        #expect(!scenario.productsViewModel.isLoadingOrderingProducts)
        #expect(scenario.freshnessViewModel.state == .unavailable)
        #expect(scenario.freshnessViewModel.freshnessOperationTask == nil)
        #expect(scenario.freshnessViewModel.freshnessTimeoutTask == nil)
        #expect(scenario.localRepository.getMetadata() == nil)
    }

    @Test("Un timeout stale libera sus handles aunque el resolver siga suspendido")
    func staleAuthorizationTimeoutReleasesOwnedHandles() async throws {
        let timeoutSleeper = ControlledFreshnessSleeper()
        let scenario = await makeFreshnessAuthorizationFenceScenario(timeoutSleeper: timeoutSleeper)
        let originalMode = scenario.productsViewModel.sessionViewModel.mode

        scenario.freshnessViewModel.retry(currentMode: originalMode)
        let tasks = try #require(ownedRefreshTasks(in: scenario.freshnessViewModel))
        defer {
            tasks.operation.cancel()
            tasks.timeout.cancel()
            scenario.refresher.cancelAll()
        }
        try await scenario.refresher.waitUntilStarted()
        try await timeoutSleeper.waitForRequestCount(1)

        let inactiveMember = replacingFreshnessActiveState(in: scenario.activeMember, with: false)
        scenario.productsViewModel.sessionViewModel.applyUpdatedAuthorizedMember(
            inactiveMember,
            members: [inactiveMember]
        )
        await timeoutSleeper.completeRequest(at: 0)
        await tasks.timeout.value
        await tasks.operation.value

        #expect(scenario.freshnessViewModel.state == .unavailable)
        #expect(scenario.freshnessViewModel.freshnessOperationTask == nil)
        #expect(scenario.freshnessViewModel.freshnessTimeoutTask == nil)
        #expect(scenario.productsViewModel.myOrderProducts == scenario.originalProducts)
        #expect(!scenario.productsViewModel.hasLoadedOrderingProducts)
        #expect(scenario.localRepository.getMetadata() == nil)
    }
}

private struct FreshnessAuthorizationFenceScenario {
    let productsViewModel: ProductsRouteViewModel
    let freshnessViewModel: MyOrderFreshnessViewModel
    let localRepository: InMemoryCriticalDataFreshnessLocalRepository
    let refresher: SuspendedAuthorizationFreshnessRefresher
    let activeMember: Member
    let originalProducts: [Product]
}

@MainActor
private func makeFreshnessAuthorizationFenceScenario(
    timeoutSleeper: ControlledFreshnessSleeper? = nil
) async -> FreshnessAuthorizationFenceScenario {
    let activeMember = member(id: "freshness_revoked", ecoCommitmentMode: .weekly)
    let staleProduct = regularProduct(
        id: "stale_after_revocation",
        vendorId: activeMember.id,
        name: "No aplicar"
    )
    let productsViewModel = await makeProductsViewModel(
        currentMember: activeMember,
        members: [activeMember],
        productRepository: InMemoryProductRepository()
    )
    productsViewModel.myOrderProducts = [regularProduct(
        id: "preserved",
        vendorId: activeMember.id,
        name: "Conservar"
    )]
    let localRepository = InMemoryCriticalDataFreshnessLocalRepository()
    let refresher = SuspendedAuthorizationFreshnessRefresher(
        payload: CriticalDataRefreshPayload(
            authenticatedMember: activeMember,
            selectedMember: activeMember,
            members: [activeMember],
            products: [staleProduct],
            seasonalCommitments: []
        )
    )
    let freshnessViewModel = makeAuthorizationFencedFreshnessViewModel(
        productsViewModel: productsViewModel,
        localRepository: localRepository,
        refresher: refresher,
        timeoutSleeper: timeoutSleeper
    )
    return FreshnessAuthorizationFenceScenario(
        productsViewModel: productsViewModel,
        freshnessViewModel: freshnessViewModel,
        localRepository: localRepository,
        refresher: refresher,
        activeMember: activeMember,
        originalProducts: productsViewModel.myOrderProducts
    )
}

@MainActor
private func makeAuthorizationFencedFreshnessViewModel(
    productsViewModel: ProductsRouteViewModel,
    localRepository: InMemoryCriticalDataFreshnessLocalRepository,
    refresher: any CriticalDataRefreshing,
    timeoutSleeper: ControlledFreshnessSleeper?,
    acknowledgesSuccessorRevision: Bool = true
) -> MyOrderFreshnessViewModel {
    MyOrderFreshnessViewModel(
        resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase(
            remoteRepository: FixedCriticalDataFreshnessRemoteRepository(
                config: validConcurrencyFreshnessConfig()
            ),
            localRepository: localRepository,
            refresher: refresher,
            nowProvider: { 2_000 }
        ),
        criticalDataFreshnessLocalRepository: localRepository,
        sessionStateRevisionProvider: {
            productsViewModel.sessionViewModel.sessionStateRevision
        },
        applyCriticalOrderingState: { context, payload in
            try await productsViewModel.refreshOrderingProductsForFreshness(
                context: context,
                payload: payload
            )
        },
        isCriticalOrderingStateCurrent: { context in
            productsViewModel.isOrderingStateCurrentForFreshness(context: context)
        },
        acknowledgedCriticalOrderingStateRevision: { context in
            guard acknowledgesSuccessorRevision,
                  productsViewModel.isOrderingStateCurrentForFreshness(context: context) else { return nil }
            return productsViewModel.sessionViewModel.sessionStateRevision
        },
        timeout: .seconds(60),
        automaticRetryDelays: [],
        sleeper: { duration in
            if let timeoutSleeper {
                try await timeoutSleeper.sleep(for: duration)
            } else {
                try await ContinuousClock().sleep(for: duration)
            }
        }
    )
}

private func replacingFreshnessActiveState(in member: Member, with isActive: Bool) -> Member {
    Member(
        id: member.id,
        displayName: member.displayName,
        companyName: member.companyName,
        phoneNumber: member.phoneNumber,
        normalizedEmail: member.normalizedEmail,
        authUid: member.authUid,
        roles: member.roles,
        isActive: isActive,
        producerCatalogEnabled: member.producerCatalogEnabled,
        isCommonPurchaseManager: member.isCommonPurchaseManager,
        producerParity: member.producerParity,
        ecoCommitmentMode: member.ecoCommitmentMode,
        ecoCommitmentParity: member.ecoCommitmentParity
    )
}

private final class SuspendedAuthorizationFreshnessRefresher: CriticalDataRefreshing, Sendable {
    private let operation = SessionRevisionOperation()
    private let payload: CriticalDataRefreshPayload

    init(payload: CriticalDataRefreshPayload) {
        self.payload = payload
    }

    func refresh(
        collections _: Set<CriticalCollection>,
        scope _: CriticalDataRefreshScope
    ) async throws -> CriticalDataRefreshPayload {
        try await operation.suspend()
        return payload
    }

    func waitUntilStarted() async throws {
        try await operation.waitUntilStarted()
    }

    func complete() {
        operation.complete()
    }

    func cancelAll() {
        operation.cancelAll()
    }
}

private actor CountingAuthorizationFreshnessRefresher: CriticalDataRefreshing {
    private let payload: CriticalDataRefreshPayload
    private(set) var requestCount = 0

    init(payload: CriticalDataRefreshPayload) {
        self.payload = payload
    }

    func refresh(
        collections _: Set<CriticalCollection>,
        scope _: CriticalDataRefreshScope
    ) async throws -> CriticalDataRefreshPayload {
        requestCount += 1
        return payload
    }
}

private extension SessionMode {
    var authorizedSession: AuthorizedSession? {
        guard case .authorized(let session) = self else { return nil }
        return session
    }
}
