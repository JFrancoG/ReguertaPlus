import Foundation
import Observation

@MainActor
@Observable
final class CoverageRehearsalViewModel {
    let coverage: ShiftCoverageViewModel
    var email = ""
    var password = ""
    var casePath: [String] = []
    var draft: CoverageCommandDraft?
    var showsAdministration = false
    var administrationDraft: CoverageAdministrationDraft?
    private(set) var isSigningIn = false
    private(set) var loginFailed = false
    private(set) var pendingPushEventID: String?
    @ObservationIgnored private let access: any CoverageRehearsalAccess
    @ObservationIgnored private var draftSession: ShiftCoverageSession?
    @ObservationIgnored private var administrationDraftSession: ShiftCoverageSession?
    @ObservationIgnored private var revision: UInt64 = 0

    init(access: any CoverageRehearsalAccess) {
        self.access = access
        coverage = ShiftCoverageViewModel(repository: access.repository)
    }

    var canSignIn: Bool { !isSigningIn && !email.trimmingCharacters(in: .whitespaces).isEmpty && !password.isEmpty }

    func signIn() async {
        guard canSignIn else { return }
        revision &+= 1
        let owner = revision
        let secret = password
        password = ""
        isSigningIn = true
        loginFailed = false
        do {
            let session = try await access.signIn(email: email.trimmingCharacters(in: .whitespaces), password: secret)
            guard revision == owner else { return }
            coverage.bind(session)
            await coverage.refresh()
        } catch {
            guard revision == owner else { return }
            loginFailed = true
        }
        guard revision == owner else { return }
        isSigningIn = false
    }

    func signOut() {
        pendingPushEventID = nil
        revision &+= 1
        access.signOut()
        coverage.bind(nil)
        casePath = []
        password = ""
        draft = nil
        administrationDraft = nil
        showsAdministration = false
        isSigningIn = false
        loginFailed = false
    }

    /// A push grants no access. Defer its authenticated read until login and command reconciliation finish.
    func acceptPush(_ reference: ShiftNotificationPushReference) {
        guard reference.isCoverage else { return }
        pendingPushEventID = reference.eventID
    }

    var readyPushEventID: String? {
        guard coverage.session != nil, !isSigningIn, !coverage.isBusy,
              !coverage.hasPendingCommand, draft == nil, administrationDraft == nil,
              !showsAdministration else { return nil }
        return pendingPushEventID
    }

    func openPendingPush() async {
        guard let eventID = readyPushEventID else { return }
        pendingPushEventID = nil
        await openNotification(eventID)
    }

    func openNotification(_ eventId: String) async {
        guard draft == nil, administrationDraft == nil, !showsAdministration else { return }
        if let caseId = await coverage.openNotification(eventId) {
            casePath = [caseId]
        }
    }

    func reloadOverviewAfterNavigation() async {
        guard casePath.isEmpty, coverage.session != nil else { return }
        await coverage.refreshOverview()
    }

    var canOpen: Bool {
        !coverage.isBusy && !coverage.hasPendingCommand &&
            coverage.snapshot?.availableShifts?.contains(where: \.writable) == true
    }

    func present(_ action: ShiftCoverageCommand.Action, item: ShiftCoverageSnapshot.Case? = nil) {
        guard let snapshot = coverage.snapshot, !coverage.isBusy, !coverage.hasPendingCommand,
              administrationDraft == nil else { return }
        draftSession = coverage.session
        draft = CoverageCommandDraft(
            action: action,
            item: item,
            snapshot: snapshot,
            nowMillis: coverage.nowMillis
        )
    }

    var canConfirmDraft: Bool {
        guard let draft, let command = draft.command, let snapshot = coverage.snapshot,
              draftSession == coverage.session, !coverage.isBusy, !coverage.hasPendingCommand else { return false }
        if let expires = command.expiresAtMillis, expires <= coverage.nowMillis {
            return false
        }
        if command.action == .open {
            return snapshot.availableShifts?.contains {
                $0.shiftId == command.shiftId && $0.shiftRevision == command.expectedShiftRevision &&
                    $0.writable && $0.scheduledAtMillis > coverage.nowMillis
            } == true
        }
        guard let item = coverage.caseItem(command.caseId), item.revision == command.expectedRevision,
              item.shiftRevision == command.expectedShiftRevision else { return false }
        return coverage.actions(for: item).contains(command.action)
    }

    func confirmDraft() async {
        guard canConfirmDraft, let draft, let command = draft.command else { return }
        self.draft = nil
        await coverage.submit(command)
    }

    var canAdminister: Bool {
        coverage.snapshot?.isAdmin == true && !coverage.isBusy && !coverage.hasPendingCommand && draft == nil
    }

    func openAdministration() {
        guard canAdminister else { return }
        showsAdministration = true
    }

    func presentAdministration(_ subject: CoverageAdministrationDraft.Subject) {
        guard canAdminister, administrationDraft == nil, let snapshot = coverage.administration else { return }
        let candidate = CoverageAdministrationDraft(subject: subject)
        guard candidate.isCurrent(in: snapshot, nowMillis: coverage.nowMillis) else { return }
        administrationDraftSession = coverage.session
        administrationDraft = candidate
    }

    var canConfirmAdministration: Bool {
        guard let administrationDraft, administrationDraft.command != nil, canAdminister,
              administrationDraftSession == coverage.session,
              let snapshot = coverage.administration else { return false }
        return administrationDraft.isCurrent(in: snapshot, nowMillis: coverage.nowMillis)
    }

    func confirmAdministration() async {
        guard canConfirmAdministration, let command = administrationDraft?.command else { return }
        administrationDraft = nil
        await coverage.submitAdministration(command)
    }

    func clearAdministrationPresentation() {
        administrationDraft = nil
        administrationDraftSession = nil
        showsAdministration = false
    }
}
