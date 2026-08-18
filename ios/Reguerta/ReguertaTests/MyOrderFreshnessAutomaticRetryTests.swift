import Testing

@testable import Reguerta

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct MyOrderFreshnessAutomaticRetryTests {
    @Test("Un fallo transitorio reintenta automaticamente y recupera Mi pedido")
    func transientFailureRetriesAutomatically() async throws {
        let remoteRepository = ControlledCriticalDataFreshnessRemoteRepository()
        let timeoutSleeper = ControlledFreshnessSleeper()
        let retrySleeper = ControlledFreshnessSleeper()
        let viewModel = makeControlledFreshnessViewModel(
            remoteRepository: remoteRepository,
            timeoutSleeper: timeoutSleeper,
            automaticRetrySleeper: retrySleeper
        )
        let mode = freshnessAuthorizedMode(uid: "uid_automatic_retry")

        viewModel.retry(currentMode: mode)
        guard let firstTasks = ownedRefreshTasks(in: viewModel) else { return }
        try await remoteRepository.waitForRequestCount(1)
        await remoteRepository.completeRequest(at: 0, with: invalidConcurrencyFreshnessConfig())
        await firstTasks.operation.value
        await firstTasks.timeout.value

        #expect(viewModel.state == .unavailable)
        try await retrySleeper.waitForRequestCount(1)
        #expect(await remoteRepository.requestCount() == 1)

        await retrySleeper.completeRequest(at: 0)
        try await remoteRepository.waitForRequestCount(2)
        guard let retryTasks = ownedRefreshTasks(in: viewModel) else { return }
        await remoteRepository.completeRequest(at: 1, with: validConcurrencyFreshnessConfig())
        await retryTasks.operation.value
        await retryTasks.timeout.value

        #expect(await remoteRepository.requestCount() == 2)
        #expect(viewModel.state == .ready)
    }

    @Test("Cerrar sesion cancela un reintento automatico pendiente")
    func signOutCancelsScheduledAutomaticRetry() async throws {
        let remoteRepository = ControlledCriticalDataFreshnessRemoteRepository()
        let timeoutSleeper = ControlledFreshnessSleeper()
        let retrySleeper = ControlledFreshnessSleeper()
        let viewModel = makeControlledFreshnessViewModel(
            remoteRepository: remoteRepository,
            timeoutSleeper: timeoutSleeper,
            automaticRetrySleeper: retrySleeper
        )
        let mode = freshnessAuthorizedMode(uid: "uid_retry_signout")

        viewModel.retry(currentMode: mode)
        guard let firstTasks = ownedRefreshTasks(in: viewModel) else { return }
        try await remoteRepository.waitForRequestCount(1)
        await remoteRepository.completeRequest(at: 0, with: invalidConcurrencyFreshnessConfig())
        await firstTasks.operation.value
        await firstTasks.timeout.value
        try await retrySleeper.waitForRequestCount(1)

        viewModel.handleSessionModeChange(from: mode, to: .signedOut)
        await Task.yield()

        #expect(viewModel.state == .idle)
        #expect(viewModel.freshnessRetryTask == nil)
        #expect(await remoteRepository.requestCount() == 1)
    }
}
