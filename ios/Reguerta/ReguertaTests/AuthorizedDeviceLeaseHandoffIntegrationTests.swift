import Testing

@testable import Reguerta

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct AuthorizedDeviceLeaseHandoffIntegrationTests {
    @Test("Refresh benigno conserva el registro persistido en curso")
    func benignRefreshKeepsPersistedInFlightRegistrationOwner() async throws {
        let scenario = makeAuthorizedDeviceLeaseHandoffScenario(
            suspendedRegistrarRegistrationIndex: nil,
            suspendedRepositoryRegistrationIndex: 0
        )
        defer { scenario.cancelAll() }

        await scenario.viewModel.applyAuthorizedSession(principal: scenario.principal)
        try await scenario.registrar.waitForRegistrationCount(1)
        try await scenario.repository.waitForRegistrationAttemptCount(1)
        let registration = try #require(scenario.viewModel.authorizedDeviceRegistrationTask)
        let registrationRevision = scenario.viewModel.authorizedDeviceRegistrationRevision
        let deviceLease = try #require(scenario.viewModel.authorizedDeviceSessionLease)
        let environmentLease = try #require(scenario.viewModel.authorizedEnvironmentLease)

        #expect(try await scenario.repository.isRegistrationCurrent(at: 0) == true)

        scenario.viewModel.refreshSession(trigger: .startup)
        try await scenario.provider.waitForRefreshRequestCount(1)
        let refreshOperation = try #require(scenario.viewModel.sessionOperationTask)
        scenario.provider.completeRefresh(with: .active(scenario.principal))
        await refreshOperation.value

        #expect(scenario.viewModel.authorizedDeviceRegistrationRevision == registrationRevision)
        #expect(scenario.viewModel.authorizedDeviceSessionLease == deviceLease)
        #expect(scenario.viewModel.authorizedEnvironmentLease == environmentLease)
        #expect(scenario.registrar.registrationCount == 1)
        #expect(scenario.repository.registrationAttemptCount == 1)
        #expect(try await scenario.repository.isRegistrationCurrent(at: 0) == true)

        scenario.repository.releaseSuspendedRegistration()
        await registration.value
        try await scenario.registrar.waitForRegistrationCompletionCount(1)
        #expect(scenario.viewModel.authorizedDeviceRegistrationTask == nil)

        scenario.viewModel.signOut()
        if let cleanup = scenario.viewModel.sessionOperationTask {
            await cleanup.value
        }
    }

    @Test("Refresh reutiliza leases y su registro cancelado tardio no desposee al sucesor")
    func benignRefreshReusesLeasesAndCancelledLateRegistrationCannotClobberSuccessor() async throws {
        let scenario = makeAuthorizedDeviceLeaseHandoffScenario()
        defer { scenario.cancelAll() }

        await scenario.viewModel.applyAuthorizedSession(principal: scenario.principal)
        try await scenario.registrar.waitForRegistrationCount(1)
        try await finishCurrentRegistration(in: scenario, completionCount: 1)
        let leaseA = try #require(scenario.registrar.command(at: 0)?.lease)
        let environmentLeaseA = try #require(scenario.viewModel.authorizedEnvironmentLease)

        scenario.viewModel.refreshSession(trigger: .startup)
        try await scenario.provider.waitForRefreshRequestCount(1)
        let refreshOperation = try #require(scenario.viewModel.sessionOperationTask)
        scenario.provider.completeRefresh(with: .active(scenario.principal))
        try await scenario.registrar.waitForRegistrationCount(2)
        let leaseB = try #require(scenario.registrar.command(at: 1)?.lease)
        #expect(leaseB == leaseA)
        #expect(scenario.viewModel.authorizedEnvironmentLease == environmentLeaseA)
        await refreshOperation.value

        scenario.viewModel.signOut()
        let firstCleanupBarrier = try #require(scenario.viewModel.sessionOperationTask)
        await firstCleanupBarrier.value

        #expect(scenario.registrar.clearedLeaseIDs() == [leaseA.id])
        #expect(
            try await scenario.store.load(
                AuthorizedDeviceSessionContext.self,
                for: .authorizedDeviceContext
            ) == nil
        )

        await scenario.viewModel.applyAuthorizedSession(principal: scenario.principal)
        try await scenario.registrar.waitForRegistrationCount(3)
        try await finishCurrentRegistration(in: scenario, completionCount: 2)
        let commandC = try #require(scenario.registrar.command(at: 2))
        #expect(
            try await scenario.store.load(
                AuthorizedDeviceSessionContext.self,
                for: .authorizedDeviceContext
            )?.lease == commandC.lease
        )

        scenario.registrar.releaseSuspendedRegistration()
        try await scenario.registrar.waitForRegistrationCompletionCount(3)
        try await scenario.registrar.updateRegistrationToken("successor-token")

        #expect(scenario.repository.registrations.map(\.token) == [
            "registration-token",
            "registration-token",
            "successor-token"
        ])

        scenario.viewModel.signOut()
        if let finalCleanupBarrier = scenario.viewModel.sessionOperationTask {
            await finalCleanupBarrier.value
        }
    }

    private func finishCurrentRegistration(
        in scenario: AuthorizedDeviceLeaseHandoffScenario,
        completionCount: Int
    ) async throws {
        let registration = try #require(scenario.viewModel.authorizedDeviceRegistrationTask)
        try await scenario.registrar.waitForRegistrationCompletionCount(completionCount)
        await registration.value
        #expect(scenario.viewModel.authorizedDeviceRegistrationTask == nil)
    }
}
