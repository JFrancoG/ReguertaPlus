import Testing

@testable import Reguerta

@Suite("My Order freshness entry completion", .timeLimit(.minutes(1)))
@MainActor
struct MyOrderFreshnessEntryCompletionTests {
    @Test("La entrada termina al vencer el timeout aunque el resolver ignore cancelacion")
    func timeoutCompletesEntryBeforeNonCooperativeResolver() async throws {
        let scenario = makeFreshnessEntryCompletionScenario()
        try await withControlledFreshnessCleanup(
            remoteRepository: scenario.remoteRepository,
            sleeper: scenario.sleeper
        ) {
            let entryTask = Task { @MainActor in
                await scenario.viewModel.revalidateForEntry(context: scenario.identity)
            }

            try await scenario.remoteRepository.waitForRequestCount(1)
            try await scenario.sleeper.waitForRequestCount(1)
            let operationTask = try #require(scenario.viewModel.freshnessOperationTask)
            let timeoutTask = try #require(scenario.viewModel.freshnessTimeoutTask)
            #expect(scenario.viewModel.freshnessEntryWaiterCount == 1)

            await scenario.sleeper.completeRequest(at: 0)
            await timeoutTask.value

            #expect(await entryTask.value == false)
            #expect(scenario.viewModel.freshnessEntryWaiterCount == 0)
            #expect(scenario.viewModel.state == .timedOut)

            await scenario.remoteRepository.completeRequest(at: 0, with: freshnessEntryCompletionConfig())
            await operationTask.value
            #expect(scenario.viewModel.state == .timedOut)
        }
    }

    @Test("Una generacion sucesora termina la entrada obsoleta sin esperar su resolver")
    func successorCompletesObsoleteEntryBeforeItsResolver() async throws {
        let scenario = makeFreshnessEntryCompletionScenario()
        try await withControlledFreshnessCleanup(
            remoteRepository: scenario.remoteRepository,
            sleeper: scenario.sleeper
        ) {
            let obsoleteEntryTask = Task { @MainActor in
                await scenario.viewModel.revalidateForEntry(context: scenario.identity)
            }

            try await scenario.remoteRepository.waitForRequestCount(1)
            try await scenario.sleeper.waitForRequestCount(1)
            let obsoleteOperationTask = try #require(scenario.viewModel.freshnessOperationTask)
            let obsoleteTimeoutTask = try #require(scenario.viewModel.freshnessTimeoutTask)

            scenario.viewModel.retry(currentMode: scenario.mode)
            #expect(await obsoleteEntryTask.value == false)
            #expect(scenario.viewModel.freshnessEntryWaiterCount == 0)

            try await scenario.remoteRepository.waitForRequestCount(2)
            try await scenario.sleeper.waitForRequestCount(2)
            let successorOperationTask = try #require(scenario.viewModel.freshnessOperationTask)
            let successorTimeoutTask = try #require(scenario.viewModel.freshnessTimeoutTask)

            await scenario.remoteRepository.completeRequest(at: 1, with: freshnessEntryCompletionConfig())
            await successorOperationTask.value
            await successorTimeoutTask.value
            #expect(scenario.viewModel.state == .ready)

            await scenario.remoteRepository.completeRequest(at: 0, with: freshnessEntryCompletionConfig())
            await obsoleteOperationTask.value
            await obsoleteTimeoutTask.value
            #expect(scenario.viewModel.state == .ready)
        }
    }

    @Test("Cancelar el solicitante elimina su waiter sin cancelar el refresh compartido")
    func callerCancellationCompletesOnlyItsEntryWaiter() async throws {
        let scenario = makeFreshnessEntryCompletionScenario()
        try await withControlledFreshnessCleanup(
            remoteRepository: scenario.remoteRepository,
            sleeper: scenario.sleeper
        ) {
            let entryTask = Task { @MainActor in
                await scenario.viewModel.revalidateForEntry(context: scenario.identity)
            }

            try await scenario.remoteRepository.waitForRequestCount(1)
            try await scenario.sleeper.waitForRequestCount(1)
            let operationTask = try #require(scenario.viewModel.freshnessOperationTask)
            let timeoutTask = try #require(scenario.viewModel.freshnessTimeoutTask)

            entryTask.cancel()
            #expect(await entryTask.value == false)
            #expect(scenario.viewModel.freshnessEntryWaiterCount == 0)

            await scenario.remoteRepository.completeRequest(at: 0, with: freshnessEntryCompletionConfig())
            await operationTask.value
            await timeoutTask.value
            #expect(scenario.viewModel.state == .ready)
        }
    }

    @Test("Una entrada ya cancelada no inicia ningun refresh")
    func cancelledEntryBeforeStartLeavesFreshnessIdle() async throws {
        let scenario = makeFreshnessEntryCompletionScenario()
        try await withControlledFreshnessCleanup(
            remoteRepository: scenario.remoteRepository,
            sleeper: scenario.sleeper
        ) {
            let entryTask = Task { @MainActor in
                await scenario.viewModel.revalidateForEntry(context: scenario.identity)
            }
            entryTask.cancel()

            #expect(await entryTask.value == false)
            let remoteRequestCount = await scenario.remoteRepository.requestCount()
            let timeoutRequestCount = await scenario.sleeper.requestCount()

            #expect(scenario.viewModel.state == .idle)
            #expect(scenario.viewModel.freshnessOperationTask == nil)
            #expect(scenario.viewModel.freshnessTimeoutTask == nil)
            #expect(scenario.viewModel.freshnessRetryTask == nil)
            #expect(scenario.viewModel.freshnessEntryWaiterCount == 0)
            #expect(remoteRequestCount == 0)
            #expect(timeoutRequestCount == 0)
        }
    }

    @Test("Un waiter encolado no se registra tras ser desplazado por otra generacion")
    func supersededWaiterDoesNotRegisterAfterSuccessorStarts() async throws {
        let scenario = makeFreshnessEntryCompletionScenario()
        try await withControlledFreshnessCleanup(
            remoteRepository: scenario.remoteRepository,
            sleeper: scenario.sleeper
        ) {
            scenario.viewModel.retry(currentMode: scenario.mode)
            try await scenario.remoteRepository.waitForRequestCount(1)
            try await scenario.sleeper.waitForRequestCount(1)
            let obsoleteGeneration = scenario.viewModel.freshnessGeneration

            #expect(
                scenario.viewModel.freshnessEntryWaiterRegistrationResult(
                    generation: obsoleteGeneration,
                    identity: scenario.identity
                ) == nil
            )

            let obsoleteWaiterTask = Task { @MainActor in
                await scenario.viewModel.waitForFreshnessEntryResolution(
                    generation: obsoleteGeneration,
                    identity: scenario.identity
                )
            }
            scenario.viewModel.retry(currentMode: scenario.mode)

            try await scenario.remoteRepository.waitForRequestCount(2)
            try await scenario.sleeper.waitForRequestCount(2)
            let waiterCountBeforeCancellation = scenario.viewModel.freshnessEntryWaiterCount

            obsoleteWaiterTask.cancel()
            #expect(waiterCountBeforeCancellation == 0)
            #expect(await obsoleteWaiterTask.value == false)
            #expect(scenario.viewModel.freshnessEntryWaiterCount == 0)
        }
    }
}

private struct FreshnessEntryCompletionScenario {
    let mode: SessionMode
    let identity: MyOrderFreshnessSessionContext
    let remoteRepository: OwnedFreshnessRemoteRepository
    let sleeper: OwnedFreshnessSleeper
    let viewModel: MyOrderFreshnessViewModel
}

@MainActor
private func makeFreshnessEntryCompletionScenario() -> FreshnessEntryCompletionScenario {
    let sessionViewModel = SessionViewModel(dependencies: .preview())
    let currentMember = member(
        id: "freshness_entry_member",
        ecoCommitmentMode: .weekly,
        authUID: "freshness_entry_principal"
    )
    let session = AuthorizedSession(
        principal: AuthPrincipal(
            uid: "freshness_entry_principal",
            email: currentMember.normalizedEmail
        ),
        authenticatedMember: currentMember,
        member: currentMember,
        members: [currentMember],
        environment: .develop
    )
    let mode = SessionMode.authorized(session)
    sessionViewModel.mode = mode
    let identity = MyOrderFreshnessSessionContext(
        session: session,
        sessionStateRevision: sessionViewModel.sessionStateRevision
    )
    let remoteRepository = OwnedFreshnessRemoteRepository()
    let localRepository = InMemoryCriticalDataFreshnessLocalRepository()
    let sleeper = OwnedFreshnessSleeper()
    let viewModel = MyOrderFreshnessViewModel(
        resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase(
            remoteRepository: remoteRepository,
            localRepository: localRepository,
            nowProvider: { 2_000 }
        ),
        criticalDataFreshnessLocalRepository: localRepository,
        sessionStateRevisionProvider: { sessionViewModel.sessionStateRevision },
        timeout: .seconds(10),
        automaticRetryDelays: [],
        sleeper: { duration in try await sleeper.sleep(for: duration) }
    )
    return FreshnessEntryCompletionScenario(
        mode: mode,
        identity: identity,
        remoteRepository: remoteRepository,
        sleeper: sleeper,
        viewModel: viewModel
    )
}

private func freshnessEntryCompletionConfig() -> CriticalDataFreshnessConfig {
    CriticalDataFreshnessConfig(
        cacheExpirationMinutes: 15,
        remoteTimestampsMillis: Dictionary(
            uniqueKeysWithValues: CriticalCollection.allCases.map { ($0, 1_000) }
        )
    )
}
