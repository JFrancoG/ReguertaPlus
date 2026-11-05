import Foundation
import Testing
@testable import Reguerta

@MainActor
struct ShiftCoverageAdministrationTests {
    @Test func departureRequiresReasonAndExplicitAcknowledgmentThenReadsBackCancelledCreditHistory() async throws {
        let harness = try CoverageAdministrationHarness()
        await harness.prepare()
        let member = try #require(harness.model.administration?.members.first)
        let draft = CoverageAdministrationDraft(
            subject: .permanentDeparture(member), environment: .develop, expectedPolicyRevision: "hu084-provisional-v1"
        )
        #expect(draft.command == nil)
        draft.reason = "Permanent departure confirmed by member"
        #expect(draft.command == nil)
        draft.confirmsCreditCancellation = true
        let command = try #require(draft.command)
        harness.transport.afterCommand = try CoverageAdministrationHarness.fixture(
            "shift-coverage-administration-after-departure"
        )
        await harness.model.submitAdministration(command)
        let result = try #require(harness.model.administration?.members.first)
        #expect(result.permanentDeparture)
        #expect(result.credits.first?.pendingCount == 0)
        #expect(result.credits.first?.cancelledCount == 1)
        #expect(harness.model.snapshot?.isAdmin == true)
        #expect(!harness.model.hasPendingCommand)
        let body = try #require(harness.transport.sent.first)
        let sent = try JSONDecoder().decode(AdministrationSentCommand.self, from: body)
        #expect(sent.permanentDepartureReason == "Permanent departure confirmed by member")
        #expect(sent.expectedContextDigest == "member-source-before")
    }

    @Test func ordinaryReconciliationNeverDeclaresDepartureOrCancelsThePendingBalance() async throws {
        let harness = try CoverageAdministrationHarness()
        await harness.prepare()
        let member = try #require(harness.model.administration?.members.first)
        let draft = CoverageAdministrationDraft(
            subject: .reconcile(member), environment: .develop, expectedPolicyRevision: "hu084-provisional-v1"
        )
        await harness.model.submitAdministration(try #require(draft.command))
        let body = try #require(harness.transport.sent.first)
        let sent = try JSONDecoder().decode(AdministrationSentCommand.self, from: body)
        #expect(sent.permanentDepartureReason == nil)
        #expect(harness.model.administration?.members.first?.credits.first?.pendingCount == 1)
        #expect(harness.model.administration?.members.first?.permanentDeparture == false)
        #expect(!harness.model.hasPendingCommand)
    }

    @Test func spacingConfirmationPreservesTheExactServerPairAndRequiresForceMajeureReason() async throws {
        let harness = try CoverageAdministrationHarness()
        await harness.prepare()
        let candidate = try #require(harness.model.administration?.spacingCandidates.first)
        let draft = CoverageAdministrationDraft(
            subject: .spacing(candidate), environment: .develop, expectedPolicyRevision: "hu084-provisional-v1"
        )
        #expect(draft.command == nil)
        draft.reason = "Otherwise this delivery would remain empty"
        await harness.model.submitAdministration(try #require(draft.command))
        let body = try #require(harness.transport.sent.first)
        let sent = try JSONDecoder().decode(AdministrationSentCommand.self, from: body)
        #expect(sent.proposalId == "proposal-spacing-a")
        #expect(sent.planningRequestId == "bundle-2027")
        #expect(sent.previousDate == "2027-01-06")
        #expect(sent.date == "2027-02-17")
        #expect(sent.previousRoundNumber == 3 && sent.roundNumber == 4)
        #expect(sent.expectedContextDigest == "spacing-source-before")
        #expect(harness.model.administration != nil && !harness.model.hasPendingCommand)
    }

    @Test func uncertainAdministrationSerializesBothKindsOfMutationAndRetriesTheOriginalIntent() async throws {
        let harness = try CoverageAdministrationHarness()
        await harness.prepare()
        let member = try #require(harness.model.administration?.members.first)
        let draft = CoverageAdministrationDraft(
            subject: .reconcile(member), environment: .develop, expectedPolicyRevision: "hu084-provisional-v1"
        )
        let command = try #require(draft.command)
        harness.transport.loseFirstResponse = true
        await harness.model.submitAdministration(command)
        #expect(harness.model.pendingAdministrationCommand == command)
        await harness.model.refresh()
        await harness.model.refreshAdministration()
        await harness.model.submit(ShiftCoverageCommand(
            expectedPolicyRevision: "hu084-provisional-v1",
            environment: .develop,
            caseId: "case-a",
            operationId: "must-not-send",
            expectedRevision: 2,
            expectedShiftRevision: 4,
            action: .accept
        ))
        await harness.model.submitAdministration(command)
        #expect(harness.transport.sent.count == 1)
        await harness.model.retryPending()
        #expect(harness.transport.sent.count == 2)
        let firstBody = try #require(harness.transport.sent.first)
        let first = try JSONDecoder().decode(AdministrationSentCommand.self, from: firstBody)
        let secondBody = try #require(harness.transport.sent.last)
        let second = try JSONDecoder().decode(AdministrationSentCommand.self, from: secondBody)
        #expect(first == second)
        #expect(!harness.model.hasPendingCommand)
    }

    @Test func acknowledgedAdministrationWithFailedReadBackNeverReplaysItsWrite() async throws {
        let harness = try CoverageAdministrationHarness()
        await harness.prepare()
        let member = try #require(harness.model.administration?.members.first)
        let draft = CoverageAdministrationDraft(
            subject: .reconcile(member), environment: .develop, expectedPolicyRevision: "hu084-provisional-v1"
        )
        harness.transport.failReadBack = true
        await harness.model.submitAdministration(try #require(draft.command))
        #expect(!harness.model.hasPendingCommand)
        #expect(harness.model.administration == nil)
        await harness.model.retryPending()
        #expect(harness.transport.sent.count == 1)
        harness.transport.failReadBack = false
        await harness.model.refreshAdministration()
        #expect(harness.model.snapshot != nil && harness.model.administration != nil)
        #expect(harness.transport.sent.count == 1)
    }

    @Test(arguments: ["operation", "action", "user", "revision"])
    func unrelatedReceiptCannotAcknowledgeAnAdministrativeWrite(_ alteration: String) async throws {
        let harness = try CoverageAdministrationHarness()
        await harness.prepare()
        let member = try #require(harness.model.administration?.members.first)
        let draft = CoverageAdministrationDraft(
            subject: .reconcile(member), environment: .develop, expectedPolicyRevision: "hu084-provisional-v1"
        )
        harness.transport.receiptAlteration = alteration
        await harness.model.submitAdministration(try #require(draft.command))
        #expect(harness.model.failure == .invalidResponse)
        #expect(harness.model.pendingAdministrationCommand != nil)
        #expect(harness.model.administration == nil)
    }

    @Test(arguments: ["source", "closed", "pair", "session"])
    func refreshedAuthorityInvalidatesOpenAdministrativeConfirmation(_ alteration: String) async throws {
        let harness = try CoverageAdministrationHarness()
        await harness.prepare()
        let access = AdministrationTestAccess(repository: harness.repository)
        let screen = CoverageRehearsalViewModel(access: access)
        screen.coverage.bind(harness.current)
        await screen.coverage.refresh()
        await screen.coverage.refreshAdministration()
        if alteration == "pair" {
            let candidate = try #require(screen.coverage.administration?.spacingCandidates.first)
            screen.route.presentAdministration(.spacing(candidate))
            screen.route.administrationDraft?.reason = "Avoid an empty shift"
        } else {
            screen.route.presentAdministration(.reconcile(try #require(screen.coverage.administration?.members.first)))
        }
        #expect(screen.route.canConfirmAdministration)
        if alteration == "session" {
            screen.coverage.bind(nil)
        } else {
            let replacements = [
                "source": ("member-source-before", "member-source-changed"),
                "closed": ("\"membershipWritable\": true", "\"membershipWritable\": false"),
                "pair": ("spacing-source-before", "spacing-source-changed")
            ]
            let replacement = try #require(replacements[alteration])
            harness.transport.administration = harness.transport.administration.replacingOccurrences(
                of: replacement.0,
                with: replacement.1
            )
            await screen.coverage.refreshAdministration()
        }
        #expect(!screen.route.canConfirmAdministration)
        await screen.route.confirmAdministration()
        #expect(harness.transport.sent.isEmpty)
    }

    @Test func lateAdministrativeResponseCannotRestorePrivateDataAfterSignOut() async throws {
        let harness = try CoverageAdministrationHarness()
        await harness.model.refresh()
        harness.transport.beforeResponse = { harness.bind(nil) }
        await harness.model.refreshAdministration()
        #expect(harness.model.administration == nil)
        #expect(harness.model.snapshot == nil)
        #expect(harness.model.session == nil)
    }

    @Test func memberCannotLoadAdministrativeDataOrExposeActions() async throws {
        let harness = try CoverageAdministrationHarness()
        harness.transport.overview = harness.transport.overview.replacingOccurrences(
            of: "\"isAdmin\": true",
            with: "\"isAdmin\": false"
        )
        await harness.prepare()
        #expect(harness.transport.administrationReads == 0)
        #expect(harness.model.administration == nil)
    }
}

@MainActor
private final class CoverageAdministrationHarness {
    let transport: CoverageAdministrationTransport
    var current: ShiftCoverageSession?
    private(set) var repository: LocalShiftCoverageRepository!
    private(set) var model: ShiftCoverageViewModel!

    init() throws {
        transport = CoverageAdministrationTransport(
            overview: try Self.fixture("shift-coverage-overview").replacingOccurrences(
                of: "\"isAdmin\": false",
                with: "\"isAdmin\": true"
            ),
            administration: try Self.fixture("shift-coverage-administration")
        )
        current = ShiftCoverageSession(
            environment: .develop,
            uid: "auth-a",
            memberId: "member-a",
            authorizationRevision: 1
        )
        repository = try LocalShiftCoverageRepository(
            port: 8799,
            currentSession: { [weak self] in self?.current },
            tokenProvider: { CoverageClientHarness.token(project: "demo-reguerta-hu084-coverage", uid: "auth-a") },
            loader: transport
        )
        model = ShiftCoverageViewModel(repository: repository)
        model.bind(current)
    }

    func prepare() async {
        await model.refresh()
        await model.refreshAdministration()
    }

    func bind(_ session: ShiftCoverageSession?) {
        current = session
        model.bind(session)
    }

    static func fixture(_ name: String) throws -> String {
        let url = try #require(Bundle(for: AdministrationTestBundle.self).url(forResource: name, withExtension: "json"))
        return try String(contentsOf: url, encoding: .utf8)
    }
}

@MainActor
private final class CoverageAdministrationTransport: HTTPDataLoading {
    var overview: String
    var administration: String
    var afterCommand: String?
    var sent: [Data] = []
    var administrationReads = 0
    var loseFirstResponse = false
    var failReadBack = false
    var receiptAlteration: String?
    var beforeResponse: (@MainActor () -> Void)?

    init(overview: String, administration: String) {
        self.overview = overview
        self.administration = administration
    }

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        let body = try #require(request.httpBody)
        let command = try JSONDecoder().decode(AdministrationSentCommand.self, from: body)
        let response: String
        if command.action == "overview" {
            if failReadBack && !sent.isEmpty {
                throw URLError(.networkConnectionLost)
            }
            response = overview
        } else if command.action == "administration" {
            administrationReads += 1
            response = sent.isEmpty ? administration : afterCommand ?? administration
        } else {
            sent.append(body)
            if loseFirstResponse && sent.count == 1 {
                throw URLError(.timedOut)
            }
            let operation = receiptAlteration == "operation" ? "unrelated" : try #require(command.operationId)
            let user = receiptAlteration == "user" ? "unrelated" : try #require(command.userId)
            let action = receiptAlteration == "action" ? "unrelated" : command.action
            let revision = receiptAlteration == "revision" ? 3 : 4
            let result = command.action == "reconcileMembership"
                ? "\"membershipRevision\":\(revision),\"exceptionId\":null"
                : "\"membershipRevision\":null,\"exceptionId\":\"approved-exception\""
            response = """
            {"ok":true,"data":{"schemaVersion":1,"environment":"develop","operationId":"\(operation)",
            "action":"\(action)","userId":"\(user)","replayed":\(sent.count > 1),\(result)}}
            """
        }
        beforeResponse?()
        let url = try #require(request.url)
        let http = try #require(HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil, headerFields: nil))
        return (Data(response.utf8), http)
    }
}

private struct AdministrationSentCommand: Decodable, Equatable {
    let action: String
    let operationId: String?
    let userId: String?
    let expectedRevision: Int64?
    let expectedContextDigest: String?
    let permanentDepartureReason: String?
    let proposalId: String?
    let planningRequestId: String?
    let previousDate: String?
    let previousRoundNumber: Int64?
    let date: String?
    let roundNumber: Int64?
    let reason: String?
}

@MainActor
private struct AdministrationTestAccess: CoverageRehearsalAccess {
    let repository: any ShiftCoverageRepository
    func signIn(email: String, password: String) async throws -> ShiftCoverageSession {
        throw ShiftCoverageFailure.unavailable
    }
    func signOut() {}
}

private final class AdministrationTestBundle: NSObject {}
