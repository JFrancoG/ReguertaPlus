import Testing

@testable import Reguerta

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct MyOrderFreshnessRefreshBarrierTests {
    @Test("El ACK espera a que el estado completo de Mi pedido quede aplicado")
    func acknowledgementWaitsForCriticalOrderingStateApplication() async throws {
        let localRepository = InMemoryCriticalDataFreshnessLocalRepository()
        let applier = ControlledOrderingStateApplier()
        let viewModel = makeBarrierViewModel(
            localRepository: localRepository,
            applyCriticalOrderingState: { context, _ in
                try await applier.apply(scope: context.refreshScope)
            }
        )

        viewModel.retry(currentMode: barrierAuthorizedMode(uid: "uid_apply"))
        let tasks = try #require(barrierOwnedTasks(in: viewModel))
        await applier.waitForRequestCount(1)

        #expect(viewModel.state == .checking)
        #expect(localRepository.getMetadata() == nil)

        await applier.completeRequest(at: 0, failing: false)
        await tasks.operation.value
        await tasks.timeout.value

        #expect(viewModel.state == .ready)
        #expect(localRepository.getMetadata()?.principalUID == "uid_apply")
    }

    @Test("Un fallo consumidor no reconoce timestamps y el retry recupera")
    func failedConsumerApplicationDoesNotAcknowledgeAndRetryRecovers() async throws {
        let localRepository = InMemoryCriticalDataFreshnessLocalRepository()
        let applier = RecoveringOrderingStateApplier()
        let viewModel = makeBarrierViewModel(
            localRepository: localRepository,
            applyCriticalOrderingState: { context, _ in
                try await applier.apply(scope: context.refreshScope)
            }
        )
        let mode = barrierAuthorizedMode(uid: "uid_retry")

        viewModel.retry(currentMode: mode)
        let failedTasks = try #require(barrierOwnedTasks(in: viewModel))
        await failedTasks.operation.value
        await failedTasks.timeout.value

        #expect(viewModel.state == .unavailable)
        #expect(localRepository.getMetadata() == nil)

        viewModel.retry(currentMode: mode)
        let recoveredTasks = try #require(barrierOwnedTasks(in: viewModel))
        await recoveredTasks.operation.value
        await recoveredTasks.timeout.value

        #expect(viewModel.state == .ready)
        #expect(localRepository.getMetadata()?.principalUID == "uid_retry")
        #expect(await applier.requestCount() == 2)
    }

    @Test("Un snapshot consumidor desplazado antes del ACK falla cerrado")
    func supersededConsumerSnapshotDoesNotAcknowledge() async throws {
        let localRepository = InMemoryCriticalDataFreshnessLocalRepository()
        let viewModel = makeBarrierViewModel(
            localRepository: localRepository,
            isCriticalOrderingStateCurrent: { _ in false }
        )

        viewModel.retry(currentMode: barrierAuthorizedMode(uid: "uid_superseded_consumer"))
        let tasks = try #require(barrierOwnedTasks(in: viewModel))
        await tasks.operation.value
        await tasks.timeout.value

        #expect(viewModel.state == .unavailable)
        #expect(localRepository.getMetadata() == nil)
    }

    @Test("La entrada espera su propia generacion de freshness")
    func entryRequestWaitsForItsOwnFreshnessGeneration() async {
        let applier = ControlledOrderingStateApplier()
        let viewModel = makeBarrierViewModel(
            applyCriticalOrderingState: { context, _ in
                try await applier.apply(scope: context.refreshScope)
            }
        )
        let mode = barrierAuthorizedMode(uid: "uid_entry")

        let firstEntry = Task { @MainActor in
            await viewModel.revalidateForEntry(currentMode: mode)
        }
        await applier.waitForRequestCount(1)
        let secondEntry = Task { @MainActor in
            await viewModel.revalidateForEntry(currentMode: mode)
        }
        await applier.waitForRequestCount(2)

        await applier.completeRequest(at: 1, failing: false)
        #expect(await secondEntry.value)

        await applier.completeRequest(at: 0, failing: false)
        #expect(await !firstEntry.value)
        #expect(viewModel.state == .ready)
    }

    @Test("El timeout durante refresh bloquea ACK aunque la lectura termine tarde")
    func timeoutDuringRefreshDoesNotAcknowledgeLateCompletion() async throws {
        let localRepository = InMemoryCriticalDataFreshnessLocalRepository()
        let refresher = ControlledCriticalDataRefresher()
        let sleeper = ControlledBarrierSleeper()
        let viewModel = makeBarrierViewModel(
            localRepository: localRepository,
            refresher: refresher,
            sleeper: { duration in try await sleeper.sleep(for: duration) }
        )

        viewModel.retry(currentMode: barrierAuthorizedMode(uid: "uid_timeout_refresh"))
        let tasks = try #require(barrierOwnedTasks(in: viewModel))
        await refresher.waitForRequestCount(1)
        await sleeper.waitForRequestCount(1)

        await sleeper.completeRequest(at: 0)
        await tasks.timeout.value

        #expect(viewModel.state == .timedOut)
        #expect(localRepository.getMetadata() == nil)

        await refresher.completeRequest(at: 0, failing: false)
        await tasks.operation.value

        #expect(viewModel.state == .timedOut)
        #expect(localRepository.getMetadata() == nil)
    }

    @Test("Un relogin durante refresh solo permite reconocer a la sesion nueva")
    func reloginDuringRefreshFencesStaleAcknowledgement() async throws {
        let localRepository = InMemoryCriticalDataFreshnessLocalRepository()
        let refresher = ControlledCriticalDataRefresher()
        let viewModel = makeBarrierViewModel(
            localRepository: localRepository,
            refresher: refresher
        )
        let oldMode = barrierAuthorizedMode(uid: "uid_old")
        let newMode = barrierAuthorizedMode(uid: "uid_new")

        viewModel.retry(currentMode: oldMode)
        let staleTasks = try #require(barrierOwnedTasks(in: viewModel))
        await refresher.waitForRequestCount(1)

        viewModel.handleSessionModeChange(from: oldMode, to: newMode)
        let currentTasks = try #require(barrierOwnedTasks(in: viewModel))
        await refresher.waitForRequestCount(2)

        await refresher.completeRequest(at: 1, failing: false)
        await currentTasks.operation.value
        await currentTasks.timeout.value
        #expect(localRepository.getMetadata()?.principalUID == "uid_new")

        await refresher.completeRequest(at: 0, failing: false)
        await staleTasks.operation.value
        await staleTasks.timeout.value

        #expect(viewModel.state == .ready)
        #expect(viewModel.freshnessOperationTask == nil)
        #expect(viewModel.freshnessTimeoutTask == nil)
        #expect(localRepository.getMetadata()?.principalUID == "uid_new")
    }

    @Test("Un cambio de entorno durante refresh solo reconoce el entorno nuevo")
    func environmentChangeDuringRefreshFencesStaleAcknowledgement() async throws {
        let localRepository = InMemoryCriticalDataFreshnessLocalRepository()
        let refresher = ControlledCriticalDataRefresher()
        let viewModel = makeBarrierViewModel(
            localRepository: localRepository,
            refresher: refresher
        )
        let developMode = barrierAuthorizedMode(uid: "uid_same", environment: .develop)
        let productionMode = barrierAuthorizedMode(uid: "uid_same", environment: .production)

        viewModel.retry(currentMode: developMode)
        let staleTasks = try #require(barrierOwnedTasks(in: viewModel))
        await refresher.waitForRequestCount(1)

        viewModel.handleSessionModeChange(from: developMode, to: productionMode)
        let currentTasks = try #require(barrierOwnedTasks(in: viewModel))
        await refresher.waitForRequestCount(2)

        await refresher.completeRequest(at: 1, failing: false)
        await currentTasks.operation.value
        await currentTasks.timeout.value
        #expect(localRepository.getMetadata()?.environment == .production)

        await refresher.completeRequest(at: 0, failing: false)
        await staleTasks.operation.value
        await staleTasks.timeout.value

        #expect(viewModel.state == .ready)
        #expect(localRepository.getMetadata()?.environment == .production)
    }

    @Test("Un cambio de capacidad durante refresh solo reconoce el scope nuevo")
    func capabilityChangeDuringRefreshFencesStaleAcknowledgement() async throws {
        let localRepository = InMemoryCriticalDataFreshnessLocalRepository()
        let refresher = ControlledCriticalDataRefresher()
        let viewModel = makeBarrierViewModel(
            localRepository: localRepository,
            refresher: refresher
        )
        let memberMode = barrierAuthorizedMode(uid: "uid_promoted")
        let adminMode = barrierAuthorizedMode(uid: "uid_promoted", canManageMembers: true)

        viewModel.retry(currentMode: memberMode)
        let staleTasks = try #require(barrierOwnedTasks(in: viewModel))
        await refresher.waitForRequestCount(1)

        viewModel.handleSessionModeChange(from: memberMode, to: adminMode)
        let currentTasks = try #require(barrierOwnedTasks(in: viewModel))
        await refresher.waitForRequestCount(2)

        await refresher.completeRequest(at: 1, failing: false)
        await currentTasks.operation.value
        await currentTasks.timeout.value
        #expect(localRepository.getMetadata()?.canManageMembers == true)

        await refresher.completeRequest(at: 0, failing: false)
        await staleTasks.operation.value
        await staleTasks.timeout.value

        #expect(viewModel.state == .ready)
        #expect(localRepository.getMetadata()?.canManageMembers == true)
    }
}

private typealias BarrierFreshnessTasks = (
    operation: Task<Void, Never>,
    timeout: Task<Void, Never>
)

@MainActor private func barrierOwnedTasks(in viewModel: MyOrderFreshnessViewModel) -> BarrierFreshnessTasks? {
    guard let operation = viewModel.freshnessOperationTask,
          let timeout = viewModel.freshnessTimeoutTask else {
        Issue.record("El refresh no conserva ambas tareas")
        return nil
    }
    return (operation, timeout)
}

@MainActor
private func makeBarrierViewModel(
    localRepository: InMemoryCriticalDataFreshnessLocalRepository =
        InMemoryCriticalDataFreshnessLocalRepository(),
    refresher: any CriticalDataRefreshing = NoOpCriticalDataRefresher(),
    applyCriticalOrderingState: @escaping @MainActor @Sendable (
        MyOrderFreshnessSessionContext,
        CriticalDataRefreshPayload
    ) async throws -> Void = { _, _ in },
    isCriticalOrderingStateCurrent: @escaping @MainActor @Sendable (
        MyOrderFreshnessSessionContext
    ) -> Bool = { _ in true },
    sleeper: @escaping @Sendable (Duration) async throws -> Void = {
        try await ContinuousClock().sleep(for: $0)
    }
) -> MyOrderFreshnessViewModel {
    MyOrderFreshnessViewModel(
        resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase(
            remoteRepository: FixedCriticalDataFreshnessRemoteRepository(
                config: barrierFreshnessConfig()
            ),
            localRepository: localRepository,
            refresher: refresher,
            nowProvider: { 2_000 }
        ),
        criticalDataFreshnessLocalRepository: localRepository,
        applyCriticalOrderingState: applyCriticalOrderingState,
        isCriticalOrderingStateCurrent: isCriticalOrderingStateCurrent,
        timeout: .seconds(60),
        sleeper: sleeper
    )
}

@MainActor
private func barrierAuthorizedMode(
    uid: String,
    environment: SessionEnvironment = .develop,
    canManageMembers: Bool = false
) -> SessionMode {
    let baseMember = member(id: uid, ecoCommitmentMode: .weekly, authUID: uid)
    let currentMember = if canManageMembers {
        Member(
            id: baseMember.id,
            displayName: baseMember.displayName,
            companyName: baseMember.companyName,
            phoneNumber: baseMember.phoneNumber,
            normalizedEmail: baseMember.normalizedEmail,
            authUid: baseMember.authUid,
            roles: baseMember.roles.union([.admin]),
            isActive: baseMember.isActive,
            producerCatalogEnabled: baseMember.producerCatalogEnabled,
            isCommonPurchaseManager: baseMember.isCommonPurchaseManager,
            producerParity: baseMember.producerParity,
            ecoCommitmentMode: baseMember.ecoCommitmentMode,
            ecoCommitmentParity: baseMember.ecoCommitmentParity
        )
    } else {
        baseMember
    }
    return .authorized(
        AuthorizedSession(
            principal: AuthPrincipal(uid: uid, email: currentMember.normalizedEmail),
            authenticatedMember: currentMember,
            member: currentMember,
            members: [currentMember],
            environment: environment
        )
    )
}

private func barrierFreshnessConfig() -> CriticalDataFreshnessConfig {
    CriticalDataFreshnessConfig(
        cacheExpirationMinutes: 15,
        remoteTimestampsMillis: Dictionary(
            uniqueKeysWithValues: CriticalCollection.allCases.map { ($0, 1_000) }
        )
    )
}

private actor ControlledCriticalDataRefresher: CriticalDataRefreshing {
    private var continuations: [Int: CheckedContinuation<CriticalDataRefreshPayload, any Error>] = [:]
    private var registeredCount = 0
    private var countWaiters: [Int: CheckedContinuation<Void, Never>] = [:]

    func refresh(
        collections _: Set<CriticalCollection>,
        scope _: CriticalDataRefreshScope
    ) async throws -> CriticalDataRefreshPayload {
        let index = registeredCount
        registeredCount += 1
        countWaiters.removeValue(forKey: registeredCount)?.resume()
        return try await withCheckedThrowingContinuation { continuation in
            continuations[index] = continuation
        }
    }

    func waitForRequestCount(_ expectedCount: Int) async {
        guard registeredCount < expectedCount else { return }
        await withCheckedContinuation { continuation in
            countWaiters[expectedCount] = continuation
        }
    }

    func completeRequest(at index: Int, failing: Bool) {
        guard let continuation = continuations.removeValue(forKey: index) else {
            Issue.record("No existe el refresh critico numero \(index)")
            return
        }
        if failing {
            continuation.resume(throwing: RefreshBarrierTestError())
        } else {
            continuation.resume(returning: CriticalDataRefreshPayload())
        }
    }
}

private actor ControlledOrderingStateApplier {
    private var continuations: [Int: CheckedContinuation<Void, any Error>] = [:]
    private var registeredCount = 0
    private var countWaiters: [Int: CheckedContinuation<Void, Never>] = [:]

    func apply(scope _: CriticalDataRefreshScope) async throws {
        let index = registeredCount
        registeredCount += 1
        countWaiters.removeValue(forKey: registeredCount)?.resume()
        try await withCheckedThrowingContinuation { continuation in
            continuations[index] = continuation
        }
    }

    func waitForRequestCount(_ expectedCount: Int) async {
        guard registeredCount < expectedCount else { return }
        await withCheckedContinuation { continuation in
            countWaiters[expectedCount] = continuation
        }
    }

    func completeRequest(at index: Int, failing: Bool) {
        guard let continuation = continuations.removeValue(forKey: index) else {
            Issue.record("No existe la aplicacion consumidora numero \(index)")
            return
        }
        if failing {
            continuation.resume(throwing: RefreshBarrierTestError())
        } else {
            continuation.resume()
        }
    }
}

private actor RecoveringOrderingStateApplier {
    private var calls = 0

    func apply(scope _: CriticalDataRefreshScope) async throws {
        calls += 1
        if calls == 1 {
            throw RefreshBarrierTestError()
        }
    }

    func requestCount() -> Int { calls }
}

private actor ControlledBarrierSleeper {
    private var continuations: [Int: CheckedContinuation<Void, any Error>] = [:]
    private var cancelledRequests: Set<Int> = []
    private var registeredCount = 0
    private var nextIndex = 0
    private var countWaiters: [Int: CheckedContinuation<Void, Never>] = [:]

    func sleep(for _: Duration) async throws {
        let index = nextIndex
        nextIndex += 1
        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, any Error>) in
                if cancelledRequests.remove(index) != nil {
                    continuation.resume(throwing: CancellationError())
                } else {
                    continuations[index] = continuation
                    registeredCount += 1
                    countWaiters.removeValue(forKey: registeredCount)?.resume()
                }
            }
        } onCancel: {
            Task { await self.cancelRequest(at: index) }
        }
    }

    func waitForRequestCount(_ expectedCount: Int) async {
        guard registeredCount < expectedCount else { return }
        await withCheckedContinuation { continuation in
            countWaiters[expectedCount] = continuation
        }
    }

    func completeRequest(at index: Int) {
        continuations.removeValue(forKey: index)?.resume()
    }

    private func cancelRequest(at index: Int) {
        guard let continuation = continuations.removeValue(forKey: index) else {
            cancelledRequests.insert(index)
            return
        }
        continuation.resume(throwing: CancellationError())
    }
}

private struct RefreshBarrierTestError: Error {}
