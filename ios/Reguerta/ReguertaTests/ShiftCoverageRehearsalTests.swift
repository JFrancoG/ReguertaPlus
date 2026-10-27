import Foundation
import Testing
@testable import Reguerta

@MainActor
struct ShiftCoverageRehearsalTests {
    @Test func pushWaitsForLoginAndDraftThenResolvesCurrentCaseWithoutCommand() async throws {
        let loader = try RehearsalLoginLoader()
        let access = try LocalCoverageRehearsalAccess(loader: loader)
        let model = CoverageRehearsalViewModel(access: access)
        let eventID = "coverage-" + String(repeating: "a", count: 64)
        let reference = try #require(ShiftNotificationPushReference.validated(
            eventID: eventID,
            type: "shift_updated",
            target: "users"
        ))
        model.route.acceptPush(reference)
        await model.route.openPendingPush()
        #expect(loader.urls.isEmpty)
        model.email = "a@example.test"
        model.password = "fixture"
        await model.signIn()
        model.route.present(.accept, item: try #require(model.coverage.snapshot?.cases.first))
        await model.route.openPendingPush()
        #expect(model.route.pendingPushEventID == eventID)
        #expect(loader.notificationReads == 0)
        model.route.draft = nil
        model.route.casePath = ["case-a"]
        loader.beforeNotificationResponse = { #expect(model.route.casePath == ["case-a"]) }
        await model.route.openPendingPush()
        #expect(model.route.casePath == ["case-a"])
        #expect(model.route.pendingPushEventID == nil)
        #expect(loader.notificationReads == 1)
        await model.route.openPendingPush()
        #expect(loader.notificationReads == 1)
    }

    @Test func logoutDropsPushAndRejectsLateNotificationNavigation() async throws {
        let loader = try RehearsalLoginLoader()
        let model = CoverageRehearsalViewModel(access: try LocalCoverageRehearsalAccess(loader: loader))
        model.email = "a@example.test"
        model.password = "fixture"
        await model.signIn()
        let reference = try #require(ShiftNotificationPushReference.validated(
            eventID: "coverage-" + String(repeating: "a", count: 64),
            type: "shift_updated",
            target: "users"
        ))
        model.route.acceptPush(reference)
        loader.beforeNotificationResponse = { model.signOut() }
        await model.route.openPendingPush()
        #expect(model.route.casePath.isEmpty)
        #expect(model.coverage.session == nil)
        #expect(model.route.pendingPushEventID == nil)
        model.route.acceptPush(reference)
        model.signOut()
        #expect(model.route.pendingPushEventID == nil)
        let planning = try #require(ShiftNotificationPushReference.validated(
            eventID: "planning-event",
            type: "shift_updated",
            target: "users"
        ))
        model.route.acceptPush(planning)
        #expect(model.route.pendingPushEventID == nil)
    }

    @Test func localLoginResolvesCanonicalMemberAndLogoutInvalidatesRepository() async throws {
        let loader = try RehearsalLoginLoader()
        let access = try LocalCoverageRehearsalAccess(loader: loader)
        let session = try await access.signIn(email: "a@example.test", password: "fixture")
        #expect(session.uid == "auth-a")
        #expect(session.memberId == "member-a")
        #expect(loader.urls.map(\.port) == [9098, 8799])
        access.signOut()
        await #expect(throws: ShiftCoverageFailure.sessionChanged) {
            try await access.repository.read(caseId: nil, session: session)
        }
        #expect(loader.urls.count == 2)
    }

    @Test func productionTokenAndLogoutDuringLoginNeverReachCoverage() async throws {
        for logout in [false, true] {
            let loader = try RehearsalLoginLoader()
            let access = try LocalCoverageRehearsalAccess(loader: loader)
            if logout {
                loader.beforeLoginResponse = { access.signOut() }
            } else {
                loader.token = CoverageClientHarness.token(project: "real-project", uid: "auth-a")
            }
            await #expect(throws: logout ? ShiftCoverageFailure.sessionChanged : .localOnly) {
                try await access.signIn(email: "a@example.test", password: "fixture")
            }
            #expect(loader.urls.count == 1)
        }
    }

    @Test func drawActionsAdvanceFromCommitToRevealAndRespectAvailability() async throws {
        let harness = try CoverageClientHarness()
        harness.transport.overview = harness.transport.overview
            .replacingOccurrences(of: "\"isAdmin\": false", with: "\"isAdmin\": true")
            .replacingOccurrences(of: "\"drawAvailable\": false", with: "\"drawAvailable\": true")
            .replacingOccurrences(of: "\"offered\"", with: "\"open\"")
            .replacingOccurrences(of: "\"selectionPhase\": \"reserve\"", with: "\"selectionPhase\": \"drawRequired\"")
        await harness.model.refresh()
        #expect(harness.model.actions(for: try #require(harness.model.snapshot?.cases.first)).contains(.commitDraw))
        harness.transport.overview = harness.transport.overview.replacingOccurrences(
            of: "\"administration\": null",
            with: "\"administration\": null, \"drawCommitted\": true, \"drawAvailableAtMillis\": 1799999999999"
        )
        await harness.model.refresh()
        let actions = harness.model.actions(for: try #require(harness.model.snapshot?.cases.first))
        #expect(actions.contains(.revealDraw))
        #expect(!actions.contains(.commitDraw))
    }

    @Test func withdrawnVolunteerCannotReenterAndReadOnlyCannotAct() async throws {
        let harness = try CoverageClientHarness()
        harness.transport.overview = harness.transport.overview
            .replacingOccurrences(of: "\"offered\"", with: "\"open\"")
            .replacingOccurrences(of: "\"selectionPhase\": \"reserve\"", with: "\"selectionPhase\": \"volunteers\"")
            .replacingOccurrences(
                of: "\"volunteerClosesAtMillis\": null",
                with: "\"volunteerClosesAtMillis\": 1800003600000"
            )
        await harness.model.refresh()
        #expect(harness.model.actions(for: try #require(harness.model.snapshot?.cases.first)).contains(.volunteer))
        harness.transport.overview = harness.transport.overview
            .replacingOccurrences(
                of: "\"administration\": null",
                with: "\"administration\": null, \"hasVolunteered\": true"
            )
        await harness.model.refresh()
        #expect(!harness.model.actions(for: try #require(harness.model.snapshot?.cases.first)).contains(.volunteer))
        harness.transport.overview = harness.transport.overview.replacingOccurrences(
            of: "\"writable\": true",
            with: "\"writable\": false"
        )
        await harness.model.refresh()
        #expect(harness.model.actions(for: try #require(harness.model.snapshot?.cases.first)).isEmpty)
    }

    @Test func newAbsenceRequiresAssignedMemberAndReasonAndKeepsOperationIdentity() async throws {
        let harness = try CoverageClientHarness()
        await harness.model.refresh()
        let snapshot = try #require(harness.model.snapshot)
        let draft = CoverageCommandDraft(
            action: .open,
            item: nil,
            snapshot: snapshot,
            nowMillis: snapshot.serverTimeMillis
        )
        #expect(draft.command == nil)
        draft.memberId = "member-b"
        draft.reason = "Family appointment"
        #expect(draft.command == nil)
        draft.memberId = "member-a"
        let command = try #require(draft.command)
        #expect(command.expectedShiftRevision == 7)
        #expect(command.absentUserId == "member-a")
        #expect(command.shiftId == "market-next")
        #expect(command.operationId == draft.command?.operationId)
        #expect(command.userId == nil && command.expiresAtMillis == nil)
    }

    @Test func refreshedDeadlineAndSessionInvalidateConfirmation() async throws {
        let loader = try RehearsalLoginLoader()
        let access = try LocalCoverageRehearsalAccess(loader: loader)
        let model = CoverageRehearsalViewModel(access: access)
        let session = try await access.signIn(email: "a@example.test", password: "fixture")
        model.coverage.bind(session)
        await model.coverage.refresh()
        model.route.present(.accept, item: try #require(model.coverage.snapshot?.cases.first))
        #expect(model.route.canConfirmDraft)
        loader.overview = loader.overview.replacingOccurrences(of: "1800003600000", with: "1799999999999")
        await model.coverage.refresh()
        #expect(!model.route.canConfirmDraft)
        await model.route.confirmDraft()
        #expect(loader.urls.count == 4)
        model.signOut()
        #expect(model.route.draft == nil)
    }

    @Test func pendingOperationBlocksNewDraftEvenAfterReadRefresh() async throws {
        let harness = try CoverageClientHarness()
        let access = RehearsalTestAccess(repository: RehearsalHarnessRepository(harness: harness))
        let model = CoverageRehearsalViewModel(access: access)
        model.coverage.bind(harness.current)
        await model.coverage.refresh()
        #expect(model.route.canOpen)
        harness.transport.loseFirstCommandResponse = true
        await model.coverage.submit(harness.command)
        await model.coverage.refresh()
        #expect(!model.route.canOpen)
        model.route.present(.open)
        #expect(model.route.draft == nil)
    }
}

@MainActor
private final class RehearsalLoginLoader: HTTPDataLoading {
    var overview: String
    var token = CoverageClientHarness.token(project: "demo-reguerta-hu084-coverage", uid: "auth-a")
    var urls: [URL] = []
    var beforeLoginResponse: (@MainActor () -> Void)?
    var beforeNotificationResponse: (@MainActor () -> Void)?
    var notificationReads = 0

    private struct LoginResult: Encodable {
        let localId: String
        let idToken: String
    }

    init() throws {
        overview = try CoverageClientHarness().transport.overview
    }

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        let url = try #require(request.url)
        urls.append(url)
        let body: Data
        if url.port == 9098 {
            body = try JSONEncoder().encode(LoginResult(localId: "auth-a", idToken: token))
            beforeLoginResponse?()
        } else if String(data: request.httpBody ?? Data(), encoding: .utf8)?.contains("notification") == true {
            notificationReads += 1
            let value = try CoverageClientHarness().transport.notification.replacingOccurrences(
                of: "coverage-fixture-event",
                with: "coverage-" + String(repeating: "a", count: 64)
            )
            body = Data(value.utf8)
            beforeNotificationResponse?()
        } else {
            body = Data(overview.utf8)
        }
        return (body, try #require(HTTPURLResponse(
            url: url,
            statusCode: 200,
            httpVersion: nil,
            headerFields: nil
        )))
    }
}

@MainActor
private struct RehearsalTestAccess: CoverageRehearsalAccess {
    let repository: any ShiftCoverageRepository
    func signIn(email: String, password: String) async throws -> ShiftCoverageSession {
        throw ShiftCoverageFailure.unavailable
    }
    func signOut() {}
}

@MainActor
private struct RehearsalHarnessRepository: ShiftCoverageRepository {
    let harness: CoverageClientHarness
    func read(caseId: String?, session: ShiftCoverageSession) async throws -> ShiftCoverageSnapshot {
        await harness.model.refresh()
        return try #require(harness.model.snapshot)
    }
    func execute(_ command: ShiftCoverageCommand, session: ShiftCoverageSession) async throws {
        await harness.model.submit(command)
        if harness.model.pendingCommand != nil {
            throw ShiftCoverageFailure.unavailable
        }
    }
}
