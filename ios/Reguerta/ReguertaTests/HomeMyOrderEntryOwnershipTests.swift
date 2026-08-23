import Testing

@testable import Reguerta

@Suite("Home My Order entry ownership", .timeLimit(.minutes(1)))
@MainActor
struct HomeMyOrderEntryOwnershipTests {
    @Test("Una validacion tardia no reemplaza una navegacion posterior a pedidos recibidos")
    func lateReadyKeepsReceivedOrdersDestination() async throws {
        let remoteRepository = OwnedFreshnessRemoteRepository()
        try await withControlledFreshnessCleanup(remoteRepository: remoteRepository) {
            let rootViewModel = makeHomeEntryRootViewModel(remoteRepository: remoteRepository)
            let session = homeEntryAuthorizedSession()
            let mode = SessionMode.authorized(session)
            rootViewModel.sessionViewModel.mode = mode
            rootViewModel.productsViewModel.handleSessionModeChange(mode)

            rootViewModel.handleHomeDashboardMyOrderAction()
            let entryTask = try #require(rootViewModel.myOrderEntryTask)
            try await remoteRepository.waitForRequestCount(1)
            guard let freshnessTask = rootViewModel.myOrderFreshnessViewModel.freshnessOperationTask else {
                await remoteRepository.completeRequest(at: 0, with: nil)
                Issue.record("La entrada no conserva la operacion de freshness")
                return
            }

            rootViewModel.handleHomeDashboardReceivedOrdersAction()
            #expect(rootViewModel.homeDestination == .receivedOrders)

            await remoteRepository.completeRequest(at: 0, with: homeEntryFreshnessConfig())
            await freshnessTask.value
            await entryTask.value

            #expect(rootViewModel.myOrderFreshnessViewModel.state == .ready)
            #expect(rootViewModel.homeDestination == .receivedOrders)
            #expect(rootViewModel.myOrderEntryTask == nil)
        }
    }

    @Test("Una sesion capturada no inicia freshness con la revision de su sucesora")
    func staleCapturedSessionCannotBorrowTheSuccessorRevision() async throws {
        let remoteRepository = FailingHomeEntryFreshnessRepository()
        let rootViewModel = makeHomeEntryRootViewModel(remoteRepository: remoteRepository)
        let initialMode = SessionMode.authorized(homeEntryAuthorizedSession())
        rootViewModel.sessionViewModel.mode = initialMode
        rootViewModel.productsViewModel.handleSessionModeChange(initialMode)

        rootViewModel.handleHomeDashboardMyOrderAction()
        let entryTask = try #require(rootViewModel.myOrderEntryTask)
        rootViewModel.sessionViewModel.mode = .authorized(
            homeEntryAuthorizedSession(environment: .production)
        )
        await entryTask.value

        #expect(await remoteRepository.requestCount() == 0)
        #expect(rootViewModel.myOrderFreshnessViewModel.state == .idle)
        #expect(rootViewModel.myOrderFreshnessViewModel.freshnessOperationTask == nil)
        #expect(rootViewModel.myOrderFreshnessViewModel.freshnessTimeoutTask == nil)
        #expect(rootViewModel.homeDestination == .dashboard)
        #expect(rootViewModel.myOrderEntryTask == nil)
    }

    @Test("Un perfil actualizado conserva el intento y navega con la revision reconocida")
    func benignMemberRevisionHandoffNavigatesToMyOrder() async throws {
        let refreshedMember = homeEntryMember(displayName: "Perfil actualizado")
        let rootViewModel = makeHomeEntryRootViewModel(
            remoteRepository: FixedCriticalDataFreshnessRemoteRepository(config: homeEntryFreshnessConfig()),
            refreshedMember: refreshedMember
        )
        let initialMode = SessionMode.authorized(homeEntryAuthorizedSession())
        rootViewModel.sessionViewModel.mode = initialMode
        rootViewModel.productsViewModel.handleSessionModeChange(initialMode)
        let originalRevision = rootViewModel.sessionViewModel.sessionStateRevision

        rootViewModel.handleHomeDashboardMyOrderAction()
        let entryTask = try #require(rootViewModel.myOrderEntryTask)
        await entryTask.value

        guard case .authorized(let refreshedSession) = rootViewModel.sessionViewModel.mode else {
            Issue.record("Se esperaba conservar una sesion autorizada")
            return
        }
        #expect(rootViewModel.sessionViewModel.sessionStateRevision == originalRevision &+ 1)
        #expect(refreshedSession.member.displayName == refreshedMember.displayName)
        #expect(rootViewModel.myOrderFreshnessViewModel.state == .ready)
        #expect(rootViewModel.homeDestination == .myOrder)
        #expect(rootViewModel.myOrderEntryTask == nil)
    }

    @Test("El onChange de la revision reconocida conserva la entrada y evita otro refresh")
    func acknowledgedRevisionOnChangePreservesEntryAndRefreshOwner() async throws {
        let remoteRepository = CountingHomeEntryFreshnessRepository(config: homeEntryFreshnessConfig())
        let localRepository = InterceptingHomeEntryFreshnessLocalRepository()
        let refreshedMember = homeEntryMember(displayName: "Perfil reconocido")
        let rootViewModel = makeHomeEntryRootViewModel(
            remoteRepository: remoteRepository,
            refreshedMember: refreshedMember,
            localRepository: localRepository
        )
        let initialMode = SessionMode.authorized(homeEntryAuthorizedSession())
        rootViewModel.sessionViewModel.mode = initialMode
        rootViewModel.productsViewModel.handleSessionModeChange(initialMode)
        localRepository.beforeSave = { [weak rootViewModel] in
            guard let rootViewModel else { return }
            rootViewModel.handleSessionModeChange(
                from: initialMode,
                to: rootViewModel.sessionViewModel.mode
            )
        }

        rootViewModel.handleHomeDashboardMyOrderAction()
        let entryTask = try #require(rootViewModel.myOrderEntryTask)
        await entryTask.value
        if let remainingFreshnessTask = rootViewModel.myOrderFreshnessViewModel.freshnessOperationTask {
            await remainingFreshnessTask.value
        }

        #expect(await remoteRepository.requestCount == 1)
        #expect(rootViewModel.myOrderFreshnessViewModel.state == .ready)
        #expect(rootViewModel.homeDestination == .myOrder)
        #expect(rootViewModel.myOrderEntryTask == nil)
    }
}

private struct FixedHomeEntryCriticalDataRefresher: CriticalDataRefreshing {
    let payload: CriticalDataRefreshPayload

    func refresh(
        collections _: Set<CriticalCollection>,
        scope _: CriticalDataRefreshScope
    ) async throws -> CriticalDataRefreshPayload {
        payload
    }
}

@MainActor
private func makeHomeEntryRootViewModel(
    remoteRepository: any CriticalDataFreshnessRemoteRepository,
    refreshedMember: Member? = nil,
    localRepository: (any CriticalDataFreshnessLocalRepository)? = nil
) -> AccessRootViewModel {
    let resolvedLocalRepository = localRepository ?? InMemoryCriticalDataFreshnessLocalRepository()
    let sessionViewModel = SessionViewModel(dependencies: .preview())
    let currentMember = homeEntryMember()
    let payloadMember = refreshedMember ?? currentMember
    let freshnessDependencies = MyOrderFreshnessFeatureDependencies(
        resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase(
            remoteRepository: remoteRepository,
            localRepository: resolvedLocalRepository,
            refresher: FixedHomeEntryCriticalDataRefresher(
                payload: CriticalDataRefreshPayload(
                    authenticatedMember: payloadMember,
                    selectedMember: payloadMember,
                    members: [payloadMember],
                    products: [],
                    seasonalCommitments: []
                )
            ),
            nowProvider: { 2_000 }
        ),
        criticalDataFreshnessLocalRepository: resolvedLocalRepository
    )

    return AccessRootViewModel(
        sessionViewModel: sessionViewModel,
        productsFeatureDependencies: .preview(nowMillisProvider: { 2_000 }),
        ordersFeatureDependencies: .preview(nowMillisProvider: { 2_000 }),
        shiftsFeatureDependencies: .preview(nowMillisProvider: { 2_000 }),
        newsNotificationsFeatureDependencies: .preview(nowMillisProvider: { 2_000 }),
        sharedProfileFeatureDependencies: .preview(nowMillisProvider: { 2_000 }),
        usersFeatureDependencies: .preview(),
        myOrderFreshnessFeatureDependencies: freshnessDependencies,
        bylawsFeatureDependencies: .preview(),
        developmentTimeMachine: .transient(initialOverrideNowMillis: 2_000),
        startupVersionGateUseCase: ResolveStartupVersionGateUseCase(
            repository: FixedStartupVersionPolicyRepository(policy: nil),
            environment: .develop
        ),
        shouldSkipSplashProvider: { true }
    )
}

@MainActor
private func homeEntryAuthorizedSession(environment: SessionEnvironment = .develop) -> AuthorizedSession {
    let currentMember = homeEntryMember()
    return AuthorizedSession(
        principal: AuthPrincipal(uid: "auth_home_entry", email: currentMember.normalizedEmail),
        authenticatedMember: currentMember,
        member: currentMember,
        members: [currentMember],
        environment: environment
    )
}

@MainActor
private func homeEntryMember(displayName: String = "Home Entry Member") -> Member {
    Member(
        id: "home_entry_member",
        displayName: displayName,
        normalizedEmail: "home-entry@reguerta.test",
        authUid: "auth_home_entry",
        roles: [.member, .producer],
        isActive: true,
        producerCatalogEnabled: true,
        producerParity: .odd,
        ecoCommitmentMode: .weekly
    )
}

private func homeEntryFreshnessConfig() -> CriticalDataFreshnessConfig {
    CriticalDataFreshnessConfig(
        cacheExpirationMinutes: 15,
        remoteTimestampsMillis: Dictionary(
            uniqueKeysWithValues: CriticalCollection.allCases.map { ($0, 1_000) }
        )
    )
}

private actor FailingHomeEntryFreshnessRepository: CriticalDataFreshnessRemoteRepository {
    private var requests = 0

    func getConfig(environment _: SessionEnvironment) async throws -> CriticalDataFreshnessConfig {
        requests += 1
        throw RepositoryError.notFound(resource: "config.member")
    }

    func requestCount() -> Int { requests }
}

private actor CountingHomeEntryFreshnessRepository: CriticalDataFreshnessRemoteRepository {
    private let config: CriticalDataFreshnessConfig
    private(set) var requestCount = 0

    init(config: CriticalDataFreshnessConfig) {
        self.config = config
    }

    func getConfig(environment _: SessionEnvironment) async throws -> CriticalDataFreshnessConfig {
        requestCount += 1
        return config
    }
}

@MainActor
private final class InterceptingHomeEntryFreshnessLocalRepository: CriticalDataFreshnessLocalRepository {
    private var metadata: CriticalDataFreshnessMetadata?
    private(set) var writeGeneration: UInt64 = 0
    var beforeSave: (() -> Void)?

    func getMetadata() -> CriticalDataFreshnessMetadata? {
        metadata
    }

    func saveMetadata(
        _ metadata: CriticalDataFreshnessMetadata,
        ifWriteGeneration expectedWriteGeneration: UInt64
    ) -> Bool {
        let action = beforeSave
        beforeSave = nil
        action?()
        guard writeGeneration == expectedWriteGeneration else { return false }
        self.metadata = metadata
        return true
    }

    func clear() throws {
        writeGeneration &+= 1
        metadata = nil
    }
}
