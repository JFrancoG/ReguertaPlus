import Testing

@testable import Reguerta

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct MyOrderFreshnessViewModelConcurrencyTests {
    @Test("Una configuracion valida habilita Mi pedido") func validConfigResolvesReady() async {
        let viewModel = makeImmediateFreshnessViewModel(config: validConcurrencyFreshnessConfig())
        let mode = freshnessAuthorizedMode(uid: "uid_ready")

        viewModel.retry(currentMode: mode)
        guard let tasks = ownedRefreshTasks(in: viewModel) else { return }
        await tasks.operation.value
        await tasks.timeout.value

        #expect(viewModel.state == .ready)
    }

    @Test("Una configuracion invalida bloquea Mi pedido") func invalidConfigResolvesUnavailable() async {
        let viewModel = makeImmediateFreshnessViewModel(config: nil)
        let mode = freshnessAuthorizedMode(uid: "uid_unavailable")

        viewModel.retry(currentMode: mode)
        guard let tasks = ownedRefreshTasks(in: viewModel) else { return }
        await tasks.operation.value
        await tasks.timeout.value

        #expect(viewModel.state == .unavailable)
    }

    @Test("La misma sesion autorizada no inicia otro refresh") func samePrincipalDoesNotRefresh() async {
        let remoteRepository = ControlledCriticalDataFreshnessRemoteRepository()
        let viewModel = makeControlledFreshnessViewModel(remoteRepository: remoteRepository)
        let mode = freshnessAuthorizedMode(uid: "uid_same")
        viewModel.state = .ready

        viewModel.handleSessionModeChange(from: mode, to: mode)

        #expect(viewModel.freshnessOperationTask == nil)
        #expect(viewModel.freshnessTimeoutTask == nil)
        #expect(await remoteRepository.requestCount() == 0)
        #expect(viewModel.state == .ready)
    }

    @Test("Cambiar de principal inicia un refresh nuevo") func changedPrincipalRefreshes() async throws {
        let remoteRepository = ControlledCriticalDataFreshnessRemoteRepository()
        let viewModel = makeControlledFreshnessViewModel(remoteRepository: remoteRepository)

        viewModel.handleSessionModeChange(
            from: freshnessAuthorizedMode(uid: "uid_old"),
            to: freshnessAuthorizedMode(uid: "uid_new")
        )
        guard let tasks = ownedRefreshTasks(in: viewModel) else { return }
        try await remoteRepository.waitForRequestCount(1)
        await remoteRepository.completeRequest(at: 0, with: validConcurrencyFreshnessConfig())
        await tasks.operation.value
        await tasks.timeout.value

        #expect(await remoteRepository.requestCount() == 1)
        #expect(viewModel.state == .ready)
    }

    @Test("El ultimo retry conserva su resultado frente a una respuesta anterior tardia")
    func latestRetryWinsForSamePrincipal() async throws {
        let remoteRepository = ControlledCriticalDataFreshnessRemoteRepository()
        let viewModel = makeControlledFreshnessViewModel(remoteRepository: remoteRepository)
        let mode = freshnessAuthorizedMode(uid: "uid_member")

        viewModel.retry(currentMode: mode)
        guard let firstTasks = ownedRefreshTasks(in: viewModel) else { return }
        try await remoteRepository.waitForRequestCount(1)

        viewModel.retry(currentMode: mode)
        guard let secondTasks = ownedRefreshTasks(in: viewModel) else { return }
        try await remoteRepository.waitForRequestCount(2)

        await remoteRepository.completeRequest(at: 1, with: validConcurrencyFreshnessConfig())
        await secondTasks.operation.value
        await secondTasks.timeout.value
        #expect(viewModel.state == .ready)

        await remoteRepository.completeRequest(at: 0, with: invalidConcurrencyFreshnessConfig())
        await firstTasks.operation.value
        await firstTasks.timeout.value

        #expect(viewModel.state == .ready)
    }

    @Test("El timeout se publica antes de que termine una lectura remota no cooperativa")
    func timeoutDoesNotWaitForRemoteCompletion() async throws {
        let remoteRepository = ControlledCriticalDataFreshnessRemoteRepository()
        let localRepository = InMemoryCriticalDataFreshnessLocalRepository()
        let sleeper = ControlledFreshnessSleeper()
        let viewModel = makeControlledFreshnessViewModel(
            remoteRepository: remoteRepository,
            localRepository: localRepository,
            sleeper: sleeper
        )

        viewModel.retry(currentMode: freshnessAuthorizedMode(uid: "uid_timeout"))
        guard let tasks = ownedRefreshTasks(in: viewModel) else { return }
        try await remoteRepository.waitForRequestCount(1)
        try await sleeper.waitForRequestCount(1)

        await sleeper.completeRequest(at: 0)
        await tasks.timeout.value
        #expect(viewModel.state == .timedOut)

        await remoteRepository.completeRequest(at: 0, with: validConcurrencyFreshnessConfig())
        await tasks.operation.value

        #expect(viewModel.state == .timedOut)
        #expect(localRepository.getMetadata() == nil)
    }

    @Test("Cerrar sesion invalida el refresh antes de borrar metadata")
    func signOutInvalidatesRefreshBeforeClearingMetadata() async throws {
        let remoteRepository = ControlledCriticalDataFreshnessRemoteRepository()
        let localRepository = InMemoryCriticalDataFreshnessLocalRepository()
        localRepository.saveMetadata(concurrencyFreshnessMetadata())
        let viewModel = makeControlledFreshnessViewModel(
            remoteRepository: remoteRepository,
            localRepository: localRepository
        )
        let mode = freshnessAuthorizedMode(uid: "uid_signout")

        viewModel.retry(currentMode: mode)
        guard let refreshTasks = ownedRefreshTasks(in: viewModel) else { return }
        try await remoteRepository.waitForRequestCount(1)

        viewModel.handleSessionModeChange(from: mode, to: .signedOut)
        #expect(viewModel.state == .idle)
        #expect(localRepository.getMetadata() == nil)

        await remoteRepository.completeRequest(at: 0, with: validConcurrencyFreshnessConfig())
        await refreshTasks.operation.value
        await refreshTasks.timeout.value

        #expect(viewModel.state == .idle)
        #expect(localRepository.getMetadata() == nil)
    }

    @Test("Un relogin avanza aunque la lectura antigua ignore la cancelacion")
    func reloginProgressesWhileStaleRemoteRemainsSuspended() async throws {
        let remoteRepository = ControlledCriticalDataFreshnessRemoteRepository()
        let localRepository = InMemoryCriticalDataFreshnessLocalRepository()
        localRepository.saveMetadata(concurrencyFreshnessMetadata(timestamp: 500))
        let viewModel = makeControlledFreshnessViewModel(
            remoteRepository: remoteRepository,
            localRepository: localRepository
        )
        let oldMode = freshnessAuthorizedMode(uid: "uid_old")
        let newMode = freshnessAuthorizedMode(uid: "uid_new")

        viewModel.retry(currentMode: oldMode)
        guard let staleTasks = ownedRefreshTasks(in: viewModel) else { return }
        try await remoteRepository.waitForRequestCount(1)

        viewModel.handleSessionModeChange(from: oldMode, to: .signedOut)
        #expect(localRepository.getMetadata() == nil)

        viewModel.handleSessionModeChange(from: .signedOut, to: newMode)
        guard let currentTasks = ownedRefreshTasks(in: viewModel) else { return }
        try await remoteRepository.waitForRequestCount(2)
        await remoteRepository.completeRequest(
            at: 1,
            with: validConcurrencyFreshnessConfig(timestamp: 2_000)
        )
        await currentTasks.operation.value
        await currentTasks.timeout.value

        #expect(viewModel.state == .ready)
        #expect(localRepository.getMetadata()?.acknowledgedTimestampsMillis.values.allSatisfy { $0 == 2_000 } == true)

        await remoteRepository.completeRequest(
            at: 0,
            with: validConcurrencyFreshnessConfig(timestamp: 1_000)
        )
        await staleTasks.operation.value
        await staleTasks.timeout.value

        #expect(viewModel.state == .ready)
        #expect(localRepository.getMetadata()?.acknowledgedTimestampsMillis.values.allSatisfy { $0 == 2_000 } == true)
    }

    @Test("Un cambio de email conserva el refresh vigente del mismo UID")
    func sameUIDEmailChangeKeepsRefreshCurrent() async throws {
        let remoteRepository = ControlledCriticalDataFreshnessRemoteRepository()
        let viewModel = makeControlledFreshnessViewModel(remoteRepository: remoteRepository)
        let oldMode = freshnessAuthorizedMode(uid: "uid_same", email: "old@reguerta.test")
        let updatedMode = freshnessAuthorizedMode(uid: "uid_same", email: "new@reguerta.test")

        viewModel.retry(currentMode: oldMode)
        guard let tasks = ownedRefreshTasks(in: viewModel) else { return }
        try await remoteRepository.waitForRequestCount(1)

        viewModel.handleSessionModeChange(from: oldMode, to: updatedMode)
        await remoteRepository.completeRequest(at: 0, with: validConcurrencyFreshnessConfig())
        await tasks.operation.value
        await tasks.timeout.value

        #expect(await remoteRepository.requestCount() == 1)
        #expect(viewModel.state == .ready)
    }

}

typealias OwnedFreshnessTasks = (operation: Task<Void, Never>, timeout: Task<Void, Never>)

@MainActor func ownedRefreshTasks(in viewModel: MyOrderFreshnessViewModel) -> OwnedFreshnessTasks? {
    guard let operation = viewModel.freshnessOperationTask,
          let timeout = viewModel.freshnessTimeoutTask else {
        Issue.record("El refresh no conserva sus tareas de operacion y timeout")
        return nil
    }
    return (operation, timeout)
}

@MainActor
private func makeImmediateFreshnessViewModel(config: CriticalDataFreshnessConfig?) -> MyOrderFreshnessViewModel {
    let localRepository = InMemoryCriticalDataFreshnessLocalRepository()
    return MyOrderFreshnessViewModel(
        resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase(
            remoteRepository: FixedCriticalDataFreshnessRemoteRepository(config: config),
            localRepository: localRepository,
            nowProvider: { 2_000 }
        ),
        criticalDataFreshnessLocalRepository: localRepository,
        timeout: .seconds(60),
        automaticRetryDelays: []
    )
}

@MainActor
func makeControlledFreshnessViewModel(
    remoteRepository: ControlledCriticalDataFreshnessRemoteRepository
) -> MyOrderFreshnessViewModel {
    makeControlledFreshnessViewModel(
        remoteRepository: remoteRepository,
        localRepository: InMemoryCriticalDataFreshnessLocalRepository()
    )
}

@MainActor
private func makeControlledFreshnessViewModel(
    remoteRepository: ControlledCriticalDataFreshnessRemoteRepository,
    localRepository: any CriticalDataFreshnessLocalRepository
) -> MyOrderFreshnessViewModel {
    MyOrderFreshnessViewModel(
        resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase(
            remoteRepository: remoteRepository,
            localRepository: localRepository,
            nowProvider: { 2_000 }
        ),
        criticalDataFreshnessLocalRepository: localRepository,
        timeout: .seconds(60),
        automaticRetryDelays: []
    )
}

@MainActor
private func makeControlledFreshnessViewModel(
    remoteRepository: ControlledCriticalDataFreshnessRemoteRepository,
    localRepository: any CriticalDataFreshnessLocalRepository,
    sleeper: ControlledFreshnessSleeper
) -> MyOrderFreshnessViewModel {
    MyOrderFreshnessViewModel(
        resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase(
            remoteRepository: remoteRepository,
            localRepository: localRepository,
            nowProvider: { 2_000 }
        ),
        criticalDataFreshnessLocalRepository: localRepository,
        timeout: .seconds(60),
        automaticRetryDelays: [],
        sleeper: { duration in
            try await sleeper.sleep(for: duration)
        }
    )
}

@MainActor
func makeControlledFreshnessViewModel(
    remoteRepository: ControlledCriticalDataFreshnessRemoteRepository,
    timeoutSleeper: ControlledFreshnessSleeper,
    automaticRetrySleeper: ControlledFreshnessSleeper
) -> MyOrderFreshnessViewModel {
    let localRepository = InMemoryCriticalDataFreshnessLocalRepository()
    return MyOrderFreshnessViewModel(
        resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase(
            remoteRepository: remoteRepository,
            localRepository: localRepository,
            nowProvider: { 2_000 }
        ),
        criticalDataFreshnessLocalRepository: localRepository,
        timeout: .seconds(60),
        automaticRetryDelays: [.seconds(10), .seconds(20), .seconds(30)],
        sleeper: { duration in
            try await timeoutSleeper.sleep(for: duration)
        },
        automaticRetrySleeper: { duration in
            try await automaticRetrySleeper.sleep(for: duration)
        }
    )
}

@MainActor
func freshnessAuthorizedMode(
    uid: String,
    email: String? = nil,
    environment: SessionEnvironment = .develop
) -> SessionMode {
    let currentMember = member(id: uid, ecoCommitmentMode: .weekly)
    return .authorized(
        AuthorizedSession(
            principal: AuthPrincipal(uid: uid, email: email ?? currentMember.normalizedEmail),
            authenticatedMember: currentMember,
            member: currentMember,
            members: [currentMember],
            environment: environment
        )
    )
}

func validConcurrencyFreshnessConfig(timestamp: Int64 = 1_000) -> CriticalDataFreshnessConfig {
    CriticalDataFreshnessConfig(
        cacheExpirationMinutes: 15,
        remoteTimestampsMillis: concurrencyFreshnessTimestamps(timestamp: timestamp)
    )
}

func invalidConcurrencyFreshnessConfig() -> CriticalDataFreshnessConfig {
    CriticalDataFreshnessConfig(
        cacheExpirationMinutes: 0,
        remoteTimestampsMillis: concurrencyFreshnessTimestamps()
    )
}

private func concurrencyFreshnessMetadata(timestamp: Int64 = 1_000) -> CriticalDataFreshnessMetadata {
    CriticalDataFreshnessMetadata(
        validatedAtMillis: 1_000,
        acknowledgedTimestampsMillis: concurrencyFreshnessTimestamps(timestamp: timestamp),
        environment: .develop,
        principalUID: "uid_seed",
        memberID: "uid_seed"
    )
}

private func concurrencyFreshnessTimestamps(timestamp: Int64 = 1_000) -> [CriticalCollection: Int64] {
    Dictionary(
        uniqueKeysWithValues: CriticalCollection.allCases.map { ($0, timestamp) }
    )
}

actor ControlledCriticalDataFreshnessRemoteRepository: CriticalDataFreshnessRemoteRepository {
    private var nextRequestIndex = 0
    private var registeredRequestCount = 0
    private var requestContinuations: [Int: CheckedContinuation<CriticalDataFreshnessConfig?, Never>] = [:]
    private var nextRequestCountWaiterID = 0
    private var requestCountWaiters: [Int: (count: Int, continuation: CheckedContinuation<Void, any Error>)] = [:]

    func getConfig(environment: SessionEnvironment) async throws -> CriticalDataFreshnessConfig {
        let requestIndex = nextRequestIndex
        nextRequestIndex += 1

        let config = await withCheckedContinuation { continuation in
            requestContinuations[requestIndex] = continuation
            registeredRequestCount += 1
            resumeSatisfiedRequestCountWaiters()
        }
        guard let config else {
            throw RepositoryError.notFound(resource: "config.member")
        }
        return config
    }

    func waitForRequestCount(_ expectedCount: Int) async throws {
        guard registeredRequestCount < expectedCount else { return }
        let waiterID = nextRequestCountWaiterID
        nextRequestCountWaiterID += 1

        try await withTaskCancellationHandler {
            try Task.checkCancellation()
            try await withCheckedThrowingContinuation { continuation in
                requestCountWaiters[waiterID] = (expectedCount, continuation)
            }
        } onCancel: {
            Task { await self.cancelRequestCountWaiter(waiterID) }
        }
    }

    func requestCount() -> Int {
        nextRequestIndex
    }

    func completeRequest(at index: Int, with config: CriticalDataFreshnessConfig?) {
        guard let continuation = requestContinuations.removeValue(forKey: index) else {
            Issue.record("No existe la solicitud de freshness numero \(index)")
            return
        }
        continuation.resume(returning: config)
    }

    private func resumeSatisfiedRequestCountWaiters() {
        let satisfiedWaiterIDs = requestCountWaiters.compactMap { waiterID, waiter in
            waiter.count <= registeredRequestCount ? waiterID : nil
        }
        for waiterID in satisfiedWaiterIDs {
            requestCountWaiters.removeValue(forKey: waiterID)?.continuation.resume()
        }
    }

    private func cancelRequestCountWaiter(_ waiterID: Int) {
        requestCountWaiters
            .removeValue(forKey: waiterID)?
            .continuation
            .resume(throwing: CancellationError())
    }
}

actor ControlledFreshnessSleeper {
    private var nextRequestIndex = 0
    private var registeredRequestCount = 0
    private var requestContinuations: [Int: CheckedContinuation<Void, any Error>] = [:]
    private var cancelledRequests: Set<Int> = []
    private var nextRequestCountWaiterID = 0
    private var requestCountWaiters: [Int: (count: Int, continuation: CheckedContinuation<Void, any Error>)] = [:]

    func sleep(for _: Duration) async throws {
        let requestIndex = nextRequestIndex
        nextRequestIndex += 1

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
        guard registeredRequestCount < expectedCount else { return }
        let waiterID = nextRequestCountWaiterID
        nextRequestCountWaiterID += 1

        try await withTaskCancellationHandler {
            try Task.checkCancellation()
            try await withCheckedThrowingContinuation { continuation in
                requestCountWaiters[waiterID] = (expectedCount, continuation)
            }
        } onCancel: {
            Task { await self.cancelRequestCountWaiter(waiterID) }
        }
    }

    func completeRequest(at index: Int) {
        guard let continuation = requestContinuations.removeValue(forKey: index) else {
            Issue.record("No existe el timeout de freshness numero \(index)")
            return
        }
        continuation.resume()
    }

    private func cancelRequest(at index: Int) {
        guard let continuation = requestContinuations.removeValue(forKey: index) else {
            cancelledRequests.insert(index)
            return
        }
        continuation.resume(throwing: CancellationError())
    }

    private func resumeSatisfiedRequestCountWaiters() {
        let satisfiedWaiterIDs = requestCountWaiters.compactMap { waiterID, waiter in
            waiter.count <= registeredRequestCount ? waiterID : nil
        }
        for waiterID in satisfiedWaiterIDs {
            requestCountWaiters.removeValue(forKey: waiterID)?.continuation.resume()
        }
    }

    private func cancelRequestCountWaiter(_ waiterID: Int) {
        requestCountWaiters
            .removeValue(forKey: waiterID)?
            .continuation
            .resume(throwing: CancellationError())
    }
}
