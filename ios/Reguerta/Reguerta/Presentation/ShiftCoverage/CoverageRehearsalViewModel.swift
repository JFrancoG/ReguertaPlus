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
    private(set) var isSigningIn = false
    private(set) var loginFailed = false
    @ObservationIgnored private let access: any CoverageRehearsalAccess
    @ObservationIgnored private var draftSession: ShiftCoverageSession?
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
        revision &+= 1
        access.signOut()
        coverage.bind(nil)
        casePath = []
        password = ""
        draft = nil
        isSigningIn = false
        loginFailed = false
    }

    func openNotification(_ eventId: String) async {
        guard draft == nil else { return }
        casePath = []
        if let caseId = await coverage.openNotification(eventId) {
            casePath = [caseId]
        }
    }

    func reloadOverviewAfterNavigation() async {
        guard casePath.isEmpty, coverage.session != nil else { return }
        await coverage.refreshOverview()
    }

    var canOpen: Bool {
        !coverage.isBusy && coverage.pendingCommand == nil &&
            coverage.snapshot?.availableShifts?.contains(where: \.writable) == true
    }

    func present(_ action: ShiftCoverageCommand.Action, item: ShiftCoverageSnapshot.Case? = nil) {
        guard let snapshot = coverage.snapshot, !coverage.isBusy, coverage.pendingCommand == nil else { return }
        draftSession = coverage.session
        draft = CoverageCommandDraft(action: action, item: item, snapshot: snapshot, nowMillis: coverage.nowMillis)
    }

    var canConfirmDraft: Bool {
        guard let draft, let command = draft.command, let snapshot = coverage.snapshot,
              draftSession == coverage.session, !coverage.isBusy, coverage.pendingCommand == nil else { return false }
        if let expires = command.expiresAtMillis, expires <= coverage.nowMillis { return false }
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
}
