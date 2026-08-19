import Testing

@testable import Reguerta

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct MyOrderFreshnessAuthorizationFenceTests {
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
    timeoutSleeper: ControlledFreshnessSleeper?
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

private extension SessionMode {
    var authorizedSession: AuthorizedSession? {
        guard case .authorized(let session) = self else { return nil }
        return session
    }
}
