import Foundation
import Testing
@testable import Reguerta

@MainActor
struct FirebaseShiftCoverageIntegrationTests {
    @Test(arguments: [SessionEnvironment.develop, .production])
    func admittedPolicyLoadsCoverageForTheCapturedEnvironment(_ environment: SessionEnvironment) async throws {
        let harness = try LiveCoverageHarness(environment: environment)
        await harness.route.refreshAccess()
        #expect(harness.route.isEnabled)
        #expect(harness.transport.actions == ["access"])
        #expect(harness.route.coverage.snapshot == nil)
        await harness.route.prepareRoute()
        #expect(harness.route.coverage.snapshot?.cases.first?.absentUserId == "member-b")
        #expect(harness.route.coverage.snapshot?.credits.first?.state == .pending)
        #expect(harness.transport.environments.allSatisfy { $0 == environment.rawValue })
    }

    @Test func closedCapabilityNeverRequestsCoverageOrSendsACommand() async throws {
        let harness = try LiveCoverageHarness(environment: .production)
        harness.transport.enabled = false
        await harness.route.prepareRoute()
        harness.route.present(.open)
        #expect(!harness.route.isEnabled)
        #expect(harness.route.draft == nil)
        #expect(harness.route.coverage.snapshot == nil)
        #expect(harness.transport.actions == ["access"])
        await #expect(throws: ShiftCoverageFailure.unavailable) {
            try await harness.repository.execute(harness.command, session: harness.session)
        }
        #expect(harness.transport.actions == ["access", "access"])
    }

    @Test(arguments: ["member", "environment", "policy"])
    func mismatchedReadBackNeverPublishesPrivateCoverage(_ field: String) async throws {
        let harness = try LiveCoverageHarness(environment: .production)
        harness.transport.corruptOverview = field
        await harness.route.prepareRoute()
        #expect(harness.route.coverage.snapshot == nil)
        #expect(harness.route.coverage.failure == .invalidResponse)
        #expect(harness.transport.commandBodies.isEmpty)
    }

    @Test func authorizationChangingDuringTokenRefreshStopsTheMutationBeforeHTTP() async throws {
        let harness = try LiveCoverageHarness(environment: .production)
        await harness.route.prepareRoute()
        harness.tokens.onRefresh = { harness.current = nil }
        await harness.route.coverage.submit(harness.command)
        #expect(harness.transport.commandBodies.isEmpty)
        #expect(harness.route.coverage.snapshot == nil)
        #expect(harness.route.coverage.session == nil)
        #expect(harness.route.coverage.failure == .sessionChanged)
    }

    @Test(arguments: [false, true])
    func replacedSDKAccountCannotUseThePreviousPresentationSession(_ changesDuringRefresh: Bool) async throws {
        let harness = try LiveCoverageHarness(environment: .production)
        await harness.route.prepareRoute()
        if changesDuringRefresh {
            harness.tokens.onRefresh = { harness.tokens.currentUserID = "different-auth-user" }
        } else {
            harness.tokens.currentUserID = "different-auth-user"
        }
        await harness.route.coverage.submit(harness.command)
        #expect(harness.current == harness.session)
        #expect(harness.transport.commandBodies.isEmpty)
        #expect(harness.route.coverage.snapshot == nil)
        #expect(harness.route.coverage.session == nil)
    }

    @Test(arguments: [false, true], ["closed", "policy"])
    func preflightDriftPreservesAnUncertainIntentUntilItsOriginalPolicyReturns(
        administration: Bool,
        drift: String
    ) async throws {
        let harness = try LiveCoverageHarness(environment: .production)
        harness.transport.isAdmin = true
        await harness.route.prepareRoute()
        await harness.route.coverage.refreshAdministration()
        let adminCommand = ShiftCoverageAdministrationCommand(
            expectedPolicyRevision: "admitted-policy-v1",
            environment: .production,
            operationId: "reconcile-once",
            userId: "member-b",
            intent: .membership(
                expectedRevision: 4,
                contextDigest: "member-source-before",
                permanentDepartureReason: nil
            )
        )
        harness.transport.loseFirstCommand = true
        if administration {
            await harness.route.coverage.submitAdministration(adminCommand)
        } else {
            await harness.route.coverage.submit(harness.command)
        }
        if drift == "closed" {
            harness.transport.enabled = false
        } else {
            harness.transport.policyRevision = "new-policy-v2"
        }
        await harness.route.coverage.retryPending()
        #expect(harness.transport.commandBodies.count == 1)
        #expect(harness.route.coverage.pendingCommand == (administration ? nil : harness.command))
        #expect(harness.route.coverage.pendingAdministrationCommand == (administration ? adminCommand : nil))
        harness.transport.enabled = true
        harness.transport.policyRevision = "admitted-policy-v1"
        await harness.route.coverage.retryPending()
        #expect(harness.transport.commandBodies.count == 2)
        #expect(!harness.route.coverage.hasPendingCommand)
        let first = try #require(harness.transport.commandBodies.first)
        let last = try #require(harness.transport.commandBodies.last)
        #expect(try canonicalJSON(first) == canonicalJSON(last))
        let fields = try #require(JSONSerialization.jsonObject(with: last) as? [String: Any])
        #expect(!fields.keys.contains("expectedPolicyRevision"))
    }

    @Test(arguments: [false, true], [409, 500])
    func admissionAndServerFailuresNeverSettleAnUnknownMutation(administration: Bool, status: Int) async throws {
        let harness = try LiveCoverageHarness(environment: .production)
        harness.transport.isAdmin = true
        await harness.route.prepareRoute()
        await harness.route.coverage.refreshAdministration()
        harness.transport.commandError = (status, "coverage_unavailable")
        if administration {
            await harness.route.coverage.submitAdministration(ShiftCoverageAdministrationCommand(
                expectedPolicyRevision: "admitted-policy-v1",
                environment: .production,
                operationId: "not-settled",
                userId: "member-b",
                intent: .membership(
                    expectedRevision: 4,
                    contextDigest: "member-source-before",
                    permanentDepartureReason: nil
                )
            ))
        } else {
            await harness.route.coverage.submit(harness.command)
        }
        #expect(harness.route.coverage.hasPendingCommand)
        #expect(harness.route.coverage.failure == .unavailable)
    }

    @Test func lostResponseRequiresAnExplicitReplayOfTheSameProductionIntent() async throws {
        let harness = try LiveCoverageHarness(environment: .production)
        await harness.route.prepareRoute()
        harness.transport.loseFirstCommand = true
        await harness.route.coverage.submit(harness.command)
        #expect(harness.route.coverage.pendingCommand == harness.command)
        await harness.route.refreshAccess()
        #expect(harness.transport.commandBodies.count == 1)
        await harness.route.coverage.retryPending()
        #expect(harness.transport.commandBodies.count == 2)
        let first = try #require(harness.transport.commandBodies.first)
        let last = try #require(harness.transport.commandBodies.last)
        #expect(try JSONDecoder().decode(CoverageSentCommand.self, from: first) ==
            JSONDecoder().decode(CoverageSentCommand.self, from: last))
        #expect(harness.route.coverage.pendingCommand == nil)
        #expect(harness.route.coverage.snapshot?.cases.first?.status == .accepted)
        #expect(harness.transport.environments.allSatisfy { $0 == "production" })
    }

    @Test func oldEnvironmentIntentCannotBeReplayedIntoAnotherEnvironment() async throws {
        let harness = try LiveCoverageHarness(environment: .production)
        await harness.route.prepareRoute()
        let old = ShiftCoverageCommand(
            expectedPolicyRevision: "hu084-provisional-v1",
            environment: .develop,
            caseId: "case-a",
            operationId: "old-environment",
            expectedRevision: 2,
            expectedShiftRevision: 4,
            action: .accept
        )
        await #expect(throws: ShiftCoverageFailure.invalidResponse) {
            try await harness.repository.execute(old, session: harness.session)
        }
        #expect(harness.transport.commandBodies.isEmpty)
    }

    @Test func notificationWaitsForConfirmationThenOpensCurrentCaseWithoutWriting() async throws {
        let harness = try LiveCoverageHarness(environment: .production)
        await harness.route.prepareRoute()
        let route = try #require(harness.route)
        route.present(.accept, item: try #require(route.coverage.snapshot?.cases.first))
        route.acceptPush(ShiftNotificationPushReference(eventID: LiveCoverageTransport.eventID))
        await route.openPendingPush()
        #expect(!harness.transport.actions.contains("notification"))
        route.draft = nil
        await route.openPendingPush()
        #expect(route.casePath == ["case-a"])
        #expect(harness.transport.actions.filter { $0 == "notification" }.count == 1)
        #expect(harness.transport.commandBodies.isEmpty)
    }

    @Test(arguments: ["logout", "viewAs", "role", "commonPurchase", "environment", "relogin"])
    func normalSessionBoundaryRevokesTheEntryAndOpenDraftSynchronously(_ change: String) async throws {
        let transport = try LiveCoverageTransport(environment: .develop)
        let member = adminMember(id: "member-a", displayName: "Ana")
        let viewModel = makeShiftsViewModel(
            currentMember: member,
            members: [member],
            coverageRepositoryFactory: { current in
                FirebaseShiftCoverageRepository(
                    client: LiveCoverageHarness.client(transport: transport, tokens: normalSessionTokens()),
                    currentSession: current
                )
            }
        )
        let route = viewModel.coverage
        await route.prepareRoute()
        #expect(route.isEnabled)
        route.present(.accept, item: try #require(route.coverage.snapshot?.cases.first))
        #expect(route.draft != nil)
        var session = try #require(viewModel.currentSession)
        switch change {
        case "logout": viewModel.sessionViewModel.mode = .signedOut
        case "viewAs":
            session.member = shiftMember(id: "another-member", displayName: "Other")
            viewModel.sessionViewModel.mode = .authorized(session)
        case "role":
            let updated = shiftMember(id: "member-a", displayName: "Ana")
            viewModel.sessionViewModel.applyRefreshedAuthorizedMembers([updated])
        case "commonPurchase":
            let updated = purchaseManager(member)
            viewModel.sessionViewModel.applyUpdatedAuthorizedMember(updated, members: [updated])
        case "environment":
            session.environment = .production
            viewModel.sessionViewModel.mode = .authorized(session)
        default:
            viewModel.sessionViewModel.mode = .signedOut
            viewModel.sessionViewModel.mode = .authorized(session)
        }
        #expect(!route.isEnabled)
        #expect(!route.canConfirmDraft)
        route.synchronizeSession()
        #expect(route.draft == nil)
        #expect(route.coverage.snapshot == nil)
        #expect(transport.commandBodies.isEmpty)
    }

    @Test func normalShellRoutesCoveragePushThroughAdmissionAndCurrentCaseFetch() async throws {
        let transport = try LiveCoverageTransport(environment: .production)
        let root = makeLiveCoverageRoot(transport: transport)
        #expect(await root.openShiftNotificationPush(eventID: LiveCoverageTransport.eventID))
        #expect(root.homeDestination == .shiftCoverage)
        await root.shiftsViewModel.coverage.openPendingPush()
        #expect(root.shiftsViewModel.coverage.casePath == ["case-a"])
        #expect(transport.commandBodies.isEmpty)
        #expect(!transport.actions.contains("unknown"))
    }

    @Test func normalShellDiscardsDisabledCoveragePushWithoutOpeningTheGenericShiftResolver() async throws {
        let transport = try LiveCoverageTransport(environment: .production)
        transport.enabled = false
        let root = makeLiveCoverageRoot(transport: transport)
        #expect(await root.openShiftNotificationPush(eventID: LiveCoverageTransport.eventID))
        #expect(root.homeDestination == .dashboard)
        #expect(transport.actions == ["access"])
        #expect(root.shiftsViewModel.coverage.casePath.isEmpty)
    }

    private func purchaseManager(_ member: Member) -> Member {
        Member(
            id: member.id,
            displayName: member.displayName,
            normalizedEmail: member.normalizedEmail,
            authUid: member.authUid,
            roles: member.roles,
            isActive: true,
            producerCatalogEnabled: true,
            isCommonPurchaseManager: true
        )
    }

    private func normalSessionTokens() -> LiveCoverageTokenProvider {
        let tokens = LiveCoverageTokenProvider()
        tokens.currentUserID = "auth_member-a"
        return tokens
    }

    private func canonicalJSON(_ data: Data) throws -> Data {
        try JSONSerialization.data(withJSONObject: JSONSerialization.jsonObject(with: data), options: .sortedKeys)
    }

}
