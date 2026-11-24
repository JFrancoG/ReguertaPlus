import Foundation
import Observation

/// Shared presentation state for authenticated coverage and the isolated rehearsal. Credential handling
/// belongs to the rehearsal wrapper; normal access is admitted only for the application's current session.
@MainActor
@Observable
final class CoverageRouteViewModel {
    let coverage: ShiftCoverageViewModel
    var casePath: [String] = []
    var draft: CoverageCommandDraft?
    var showsAdministration = false
    var administrationDraft: CoverageAdministrationDraft?
    private(set) var pendingPushEventID: String?
    private(set) var isResolvingAccess = false
    private(set) var access: ShiftCoverageAccess?
    @ObservationIgnored private let repository: any ShiftCoverageRepository
    @ObservationIgnored private let sessionProvider: (@MainActor () -> ShiftCoverageSession?)?
    @ObservationIgnored private var authorization: ShiftCoverageSession?
    @ObservationIgnored private var accessGeneration: UInt64 = 0
    @ObservationIgnored private var draftSession: ShiftCoverageSession?
    @ObservationIgnored private var administrationDraftSession: ShiftCoverageSession?

    init(
        repository: any ShiftCoverageRepository,
        sessionProvider: (@MainActor () -> ShiftCoverageSession?)? = nil
    ) {
        self.repository = repository
        self.sessionProvider = sessionProvider
        coverage = ShiftCoverageViewModel(repository: repository)
    }

    var hasCurrentSession: Bool {
        guard let session = coverage.session else { return false }
        guard let sessionProvider else { return true }
        return sessionProvider() == session && access?.enabled == true
    }

    var isEnabled: Bool { hasCurrentSession }

    var hasResolvedCurrentAccess: Bool {
        access != nil && authorization != nil && sessionProvider?() == authorization
    }

    /// Clears old presentation synchronously, before any replacement authorization request suspends.
    func synchronizeSession() {
        guard let sessionProvider else { return }
        let latest = sessionProvider()
        guard latest != authorization else { return }
        accessGeneration &+= 1
        authorization = latest
        access = nil
        isResolvingAccess = false
        pendingPushEventID = nil
        bind(nil)
    }

    func bind(_ session: ShiftCoverageSession?) {
        guard coverage.session != session else { return }
        coverage.bind(session)
        casePath = []
        draft = nil
        draftSession = nil
        clearAdministrationPresentation()
    }

    func clear() {
        pendingPushEventID = nil
        coverage.bind(nil)
        leaveRoute()
    }

    func refreshAccess() async {
        guard sessionProvider != nil else { return }
        synchronizeSession()
        guard let authorization, !isResolvingAccess,
              !coverage.isBusy, !coverage.hasPendingCommand else { return }
        let owner = accessGeneration
        isResolvingAccess = true
        do {
            let result = try await repository.resolveAccess(session: authorization)
            guard owner == accessGeneration, sessionProvider?() == authorization else { return }
            try Task.checkCancellation()
            if access?.policyRevision != result.policyRevision {
                bind(nil)
            }
            access = result
            bind(result.enabled ? authorization : nil)
        } catch {
            guard owner == accessGeneration else { return }
            access = nil
            bind(nil)
        }
        guard owner == accessGeneration else { return }
        isResolvingAccess = false
    }

    func prepareRoute() async {
        await refreshAccess()
        guard hasCurrentSession else { return }
        await coverage.refresh()
    }

    /// A push grants no access. Defer its authenticated read until login and command reconciliation finish.
    func acceptPush(_ reference: ShiftNotificationPushReference) {
        guard reference.isCoverage else { return }
        pendingPushEventID = reference.eventID
    }

    var readyPushEventID: String? {
        guard hasCurrentSession, !coverage.isBusy,
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
        hasCurrentSession && !coverage.isBusy && !coverage.hasPendingCommand &&
            coverage.snapshot?.availableShifts?.contains(where: \.writable) == true
    }

    func present(_ action: ShiftCoverageCommand.Action, item: ShiftCoverageSnapshot.Case? = nil) {
        guard hasCurrentSession, let snapshot = coverage.snapshot, !coverage.isBusy, !coverage.hasPendingCommand,
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
        guard hasCurrentSession, let draft, let command = draft.command, let snapshot = coverage.snapshot,
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
        hasCurrentSession && coverage.snapshot?.isAdmin == true &&
            !coverage.isBusy && !coverage.hasPendingCommand && draft == nil
    }

    func leaveRoute() {
        casePath = []
        draft = nil
        draftSession = nil
        clearAdministrationPresentation()
    }

    func openAdministration() {
        guard canAdminister else { return }
        showsAdministration = true
    }

    func presentAdministration(_ subject: CoverageAdministrationDraft.Subject) {
        guard canAdminister, administrationDraft == nil, let snapshot = coverage.administration,
              let environment = SessionEnvironment(rawValue: snapshot.environment) else { return }
        let candidate = CoverageAdministrationDraft(
            subject: subject, environment: environment, expectedPolicyRevision: snapshot.policyRevision
        )
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
