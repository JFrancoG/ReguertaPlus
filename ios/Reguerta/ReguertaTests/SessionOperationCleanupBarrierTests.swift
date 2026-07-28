import Testing

@testable import Reguerta

extension SessionOperationInvalidationTests {
    @Test("El cierre manual rechaza logins hasta limpiar su lease")
    func manualSignOutOwnsLaneUntilAuthorizedDeviceCleanup() async {
        let registrar = ControlledSessionCleanupRegistrar()
        let freshnessRepository = ControlledSessionFreshnessRepository()
        freshnessRepository.saveMetadata(sessionCleanupFreshnessMetadata())
        let scenario = makeSessionTimeoutScenario(
            isAuthenticated: true,
            authorizedDeviceRegistrar: registrar,
            criticalDataFreshnessLocalRepository: freshnessRepository
        )
        scenario.viewModel.mode = timeoutAuthorizedMode(
            member: scenario.member,
            principal: scenario.principal
        )
        scenario.viewModel.authorizedDeviceSessionLease = AuthorizedDeviceSessionLease()

        scenario.viewModel.signOut()
        guard await registrar.waitForClearRequest() else { return }
        guard let cleanupBarrier = scenario.viewModel.sessionOperationTask else {
            Issue.record("El cierre manual no conserva la barrera de limpieza")
            return
        }
        populateValidSignIn(in: scenario)
        scenario.viewModel.signIn()
        #expect(scenario.viewModel.mode == .signedOut)
        #expect(scenario.viewModel.isSessionOperationDraining)
        #expect(scenario.provider.signInRequestCount == 0)
        #expect(freshnessRepository.getMetadata() == nil)
        #expect(freshnessRepository.clearCallCount == 1)

        await registrar.completeClear()
        await cleanupBarrier.value
        #expect(scenario.viewModel.sessionOperationState == .idle)
        #expect(scenario.viewModel.sessionOperationTask == nil)
        #expect(scenario.viewModel.sessionTerminationCleanupTask == nil)
        #expect(scenario.viewModel.canSubmitSignIn)
    }

    @Test("Un fallo al limpiar freshness mantiene la sesión fail-closed")
    func failedFreshnessCleanupKeepsSessionDraining() async {
        let freshnessRepository = ControlledSessionFreshnessRepository(clearSucceeds: false)
        let metadata = sessionCleanupFreshnessMetadata()
        freshnessRepository.saveMetadata(metadata)
        let scenario = makeSessionTimeoutScenario(
            isAuthenticated: true,
            criticalDataFreshnessLocalRepository: freshnessRepository
        )
        scenario.viewModel.mode = timeoutAuthorizedMode(
            member: scenario.member,
            principal: scenario.principal
        )

        scenario.viewModel.signOut()
        guard let cleanupBarrier = scenario.viewModel.sessionOperationTask else {
            Issue.record("El fallo de freshness no conserva la barrera")
            return
        }
        await cleanupBarrier.value
        populateValidSignIn(in: scenario)
        scenario.viewModel.signIn()

        #expect(
            scenario.viewModel.mode == .unauthorized(
                email: scenario.member.normalizedEmail,
                reason: .userAccessRestricted
            )
        )
        #expect(scenario.viewModel.isSessionOperationDraining)
        #expect(scenario.viewModel.sessionOperationTask != nil)
        #expect(freshnessRepository.getMetadata() == metadata)
        #expect(freshnessRepository.clearCallCount == 1)
        #expect(scenario.provider.signInRequestCount == 0)
    }

    @Test("El drenaje espera a limpiar el lease antes de liberar un nuevo login")
    func drainingWaitsForAuthorizedDeviceCleanup() async throws {
        let registrar = ControlledSessionCleanupRegistrar()
        let scenario = makeSessionTimeoutScenario(
            isAuthenticated: true,
            authorizedDeviceRegistrar: registrar
        )
        scenario.viewModel.mode = timeoutAuthorizedMode(
            member: scenario.member,
            principal: scenario.principal
        )
        scenario.viewModel.authorizedDeviceSessionLease = AuthorizedDeviceSessionLease()

        guard let providerOperation = try await expireRefresh(in: scenario) else { return }
        guard await registrar.waitForClearRequest() else { return }
        scenario.provider.completeRefresh(with: .active(scenario.principal))
        await providerOperation.value
        guard let cleanupBarrier = scenario.viewModel.sessionOperationTask else {
            Issue.record("El drenaje liberó el propietario antes de limpiar el lease")
            return
        }

        populateValidSignIn(in: scenario)
        scenario.viewModel.signIn()
        #expect(scenario.viewModel.isSessionOperationDraining)
        #expect(scenario.provider.signInRequestCount == 0)

        await registrar.completeClear()
        await cleanupBarrier.value
        #expect(scenario.viewModel.sessionOperationState == .idle)
        #expect(scenario.viewModel.sessionOperationTask == nil)
        #expect(scenario.viewModel.sessionTerminationCleanupTask == nil)
    }

    @Test("Un fallo al limpiar el lease mantiene la sesión fail-closed")
    func failedAuthorizedDeviceCleanupKeepsSessionDraining() async throws {
        let registrar = ControlledSessionCleanupRegistrar()
        let scenario = makeSessionTimeoutScenario(
            isAuthenticated: true,
            authorizedDeviceRegistrar: registrar
        )
        scenario.viewModel.mode = timeoutAuthorizedMode(
            member: scenario.member,
            principal: scenario.principal
        )
        scenario.viewModel.authorizedDeviceSessionLease = AuthorizedDeviceSessionLease()

        guard let providerOperation = try await expireRefresh(in: scenario) else { return }
        guard await registrar.waitForClearRequest() else { return }
        scenario.provider.completeRefresh(with: .active(scenario.principal))
        await providerOperation.value
        guard let cleanupBarrier = scenario.viewModel.sessionOperationTask else {
            Issue.record("El drenaje no conservó la barrera de limpieza")
            return
        }

        await registrar.failClear()
        await cleanupBarrier.value
        #expect(
            scenario.viewModel.mode == .unauthorized(
                email: scenario.member.normalizedEmail,
                reason: .userAccessRestricted
            )
        )
        #expect(scenario.viewModel.isSessionOperationDraining)
        #expect(scenario.viewModel.sessionOperationTask != nil)
        #expect(scenario.viewModel.sessionTerminationCleanupTask != nil)
        #expect(scenario.viewModel.feedbackCenter.messageKey == AccessL10nKey.authErrorUnknown)

        populateValidSignIn(in: scenario)
        scenario.viewModel.signIn()
        #expect(scenario.provider.signInRequestCount == 0)
    }

    @Test("Un cierre repetido no pierde un cleanup que sigue en vuelo")
    func repeatedSignOutPreservesInFlightCleanup() async {
        let registrar = ControlledSessionCleanupRegistrar()
        let scenario = makeSessionTimeoutScenario(
            isAuthenticated: true,
            authorizedDeviceRegistrar: registrar
        )
        scenario.viewModel.mode = timeoutAuthorizedMode(
            member: scenario.member,
            principal: scenario.principal
        )
        scenario.viewModel.authorizedDeviceSessionLease = AuthorizedDeviceSessionLease()

        scenario.viewModel.refreshSession(trigger: .startup)
        guard await scenario.provider.waitForRefreshRequestCount(1),
              let providerOperation = scenario.viewModel.sessionOperationTask else {
            Issue.record("El refresh no conserva su operación propietaria")
            return
        }
        scenario.viewModel.signOut()
        guard await registrar.waitForClearRequest() else { return }

        scenario.viewModel.signOut()
        scenario.provider.completeRefresh(with: .active(scenario.principal))
        await providerOperation.value

        guard let cleanupBarrier = scenario.viewModel.sessionOperationTask else {
            Issue.record("El segundo cierre perdió la barrera de limpieza")
            return
        }
        #expect(scenario.viewModel.isSessionOperationDraining)
        #expect(scenario.viewModel.sessionTerminationCleanupTask != nil)

        await registrar.completeClear()
        await cleanupBarrier.value
        #expect(scenario.viewModel.sessionOperationState == .idle)
        #expect(scenario.viewModel.sessionOperationTask == nil)
        #expect(scenario.viewModel.sessionTerminationCleanupTask == nil)
    }

    @Test("Una barrera antigua encadena el cleanup nuevo antes de liberar el carril")
    func staleCleanupBarrierWaitsForNewFailedCleanup() async {
        let registrar = ControlledSessionCleanupRegistrar()
        let freshnessRepository = ControlledSessionFreshnessRepository(
            clearResults: [true, false]
        )
        let scenario = makeSessionTimeoutScenario(
            isAuthenticated: true,
            authorizedDeviceRegistrar: registrar,
            criticalDataFreshnessLocalRepository: freshnessRepository
        )
        scenario.viewModel.mode = timeoutAuthorizedMode(
            member: scenario.member,
            principal: scenario.principal
        )
        scenario.viewModel.authorizedDeviceSessionLease = AuthorizedDeviceSessionLease()

        scenario.viewModel.signOut()
        guard await registrar.waitForClearRequest(),
              let firstCleanupBarrier = scenario.viewModel.sessionOperationTask else {
            Issue.record("El primer cierre no conserva su barrera")
            return
        }

        scenario.viewModel.signOut()
        #expect(freshnessRepository.clearCallCount == 2)
        await registrar.completeClear()
        await firstCleanupBarrier.value
        guard let failedCleanupBarrier = scenario.viewModel.sessionOperationTask else {
            Issue.record("La barrera antigua no encadenó el cleanup nuevo")
            return
        }
        await failedCleanupBarrier.value

        populateValidSignIn(in: scenario)
        scenario.viewModel.signIn()
        #expect(scenario.viewModel.isSessionOperationDraining)
        #expect(scenario.viewModel.sessionTerminationCleanupTask != nil)
        #expect(scenario.viewModel.feedbackCenter.messageKey == AccessL10nKey.authErrorUnknown)
        #expect(scenario.provider.signInRequestCount == 0)
    }

    @Test("Un cierre repetido no oculta un cleanup que ya falló")
    func repeatedSignOutPreservesFailedCleanup() async {
        let freshnessRepository = ControlledSessionFreshnessRepository(
            clearResults: [false, true]
        )
        freshnessRepository.saveMetadata(sessionCleanupFreshnessMetadata())
        let scenario = makeSessionTimeoutScenario(
            isAuthenticated: true,
            criticalDataFreshnessLocalRepository: freshnessRepository
        )
        scenario.viewModel.mode = timeoutAuthorizedMode(
            member: scenario.member,
            principal: scenario.principal
        )

        scenario.viewModel.signOut()
        guard let failedCleanupBarrier = scenario.viewModel.sessionOperationTask else {
            Issue.record("El primer cierre no conserva el cleanup fallido")
            return
        }
        await failedCleanupBarrier.value
        scenario.viewModel.signOut()

        populateValidSignIn(in: scenario)
        scenario.viewModel.signIn()
        #expect(scenario.viewModel.isSessionOperationDraining)
        #expect(scenario.viewModel.sessionTerminationCleanupTask != nil)
        #expect(freshnessRepository.clearCallCount == 2)
        #expect(scenario.provider.signInRequestCount == 0)
    }
}

@MainActor
private func expireRefresh(
    in scenario: SessionTimeoutScenario
) async throws -> Task<Void, Never>? {
    scenario.viewModel.refreshSession(trigger: .startup)
    guard await scenario.provider.waitForRefreshRequestCount(1) else { return nil }
    try await scenario.sleeper.waitForRequestCount(1)
    guard let operation = scenario.viewModel.sessionOperationTask,
          let timeout = scenario.viewModel.sessionOperationTimeoutTask else {
        Issue.record("El refresh no conserva las tareas de operación y timeout")
        return nil
    }
    await scenario.sleeper.completeRequest(at: 0)
    await timeout.value
    return operation
}

@MainActor
private func populateValidSignIn(in scenario: SessionTimeoutScenario) {
    scenario.viewModel.emailInput = scenario.member.normalizedEmail
    scenario.viewModel.passwordInput = "secret12"
}

private enum SessionCleanupTestError: Error {
    case failed
}

@MainActor
private final class ControlledSessionFreshnessRepository: CriticalDataFreshnessLocalRepository {
    private var metadata: CriticalDataFreshnessMetadata?
    private var clearResults: [Bool]
    private(set) var writeGeneration: UInt64 = 0
    private(set) var clearCallCount = 0

    init(clearSucceeds: Bool = true) {
        clearResults = [clearSucceeds]
    }

    init(clearResults: [Bool]) {
        self.clearResults = clearResults
    }

    func getMetadata() -> CriticalDataFreshnessMetadata? {
        metadata
    }

    func saveMetadata(
        _ metadata: CriticalDataFreshnessMetadata,
        ifWriteGeneration expectedWriteGeneration: UInt64
    ) {
        guard writeGeneration == expectedWriteGeneration else { return }
        self.metadata = metadata
    }

    func clear() throws {
        writeGeneration &+= 1
        clearCallCount += 1
        let succeeds = clearResults.isEmpty ? true : clearResults.removeFirst()
        guard succeeds else {
            throw SessionCleanupTestError.failed
        }
        metadata = nil
    }
}

private func sessionCleanupFreshnessMetadata() -> CriticalDataFreshnessMetadata {
    CriticalDataFreshnessMetadata(
        validatedAtMillis: 1_000,
        acknowledgedTimestampsMillis: Dictionary(
            uniqueKeysWithValues: CriticalCollection.allCases.map { ($0, 1_000) }
        ),
        environment: .develop
    )
}

private actor ControlledSessionCleanupRegistrar: AuthorizedDeviceRegistrar {
    private var clearContinuation: CheckedContinuation<Void, any Error>?

    func register(
        command _: AuthorizedDeviceRegistrationCommand,
        isSessionCurrent _: @escaping @MainActor @Sendable () -> Bool
    ) async throws -> AuthorizedDeviceRegistrationResult {
        .skipped
    }

    func updateRegistrationToken(_: String?) async throws {}

    func clearAuthorization(ifOwnedBy _: AuthorizedDeviceSessionLease) async throws {
        try await withCheckedThrowingContinuation { continuation in
            clearContinuation = continuation
        }
    }

    func waitForClearRequest() async -> Bool {
        for _ in 0 ..< 1_000 {
            if clearContinuation != nil {
                return true
            }
            await Task.yield()
        }
        Issue.record("No se inició la limpieza controlada del lease")
        return false
    }

    func completeClear() {
        let continuation = clearContinuation
        clearContinuation = nil
        continuation?.resume()
    }

    func failClear() {
        let continuation = clearContinuation
        clearContinuation = nil
        continuation?.resume(throwing: SessionCleanupTestError.failed)
    }
}
