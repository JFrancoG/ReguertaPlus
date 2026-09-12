import Foundation

extension ShiftCoverageViewModel {
    func caseItem(_ id: String) -> ShiftCoverageSnapshot.Case? { snapshot?.cases.first { $0.caseId == id } }
    func memberName(_ id: String) -> String { snapshot?.members?.first { $0.memberId == id }?.displayName ?? id }

    /// Controls are hints from the current projection; the server remains the authority for every command.
    func actions(for item: ShiftCoverageSnapshot.Case) -> [ShiftCoverageCommand.Action] {
        guard let snapshot, !isBusy, pendingCommand == nil, item.writable else { return [] }
        var actions = memberActions(item, snapshot: snapshot)
        if snapshot.isAdmin { actions += adminActions(item, policy: snapshot.policy) }
        if [.open, .offered].contains(item.status), snapshot.isAdmin || item.openedByMe == true {
            actions.append(.cancel)
        }
        return actions
    }

    private func memberActions(
        _ item: ShiftCoverageSnapshot.Case,
        snapshot: ShiftCoverageSnapshot
    ) -> [ShiftCoverageCommand.Action] {
        if item.status == .offered, item.offer?.userId == snapshot.memberId,
           let expires = item.offer?.expiresAtMillis, nowMillis < expires {
            return [.accept, .decline]
        }
        guard item.status == .open, item.selectionPhase == .volunteers,
              let closes = item.volunteerClosesAtMillis, nowMillis < closes, snapshot.eligible else { return [] }
        if item.volunteered { return [.withdrawVolunteer] }
        return item.hasVolunteered == true ? [] : [.volunteer]
    }

    private func adminActions(
        _ item: ShiftCoverageSnapshot.Case,
        policy: ShiftCoverageSnapshot.Policy
    ) -> [ShiftCoverageCommand.Action] {
        switch item.status {
        case .open: selectionActions(item, policy: policy)
        case .offered: nowMillis >= (item.offer?.expiresAtMillis ?? Int64.max) ? [.expire] : []
        case .accepted: nowMillis >= item.scheduledAtMillis ? [.complete, .fail] : [.fail]
        case .cancelled: item.canResumeAdmin == true ? [.resumeAdmin] : []
        case .completed, .failed: []
        }
    }

    private func selectionActions(
        _ item: ShiftCoverageSnapshot.Case,
        policy: ShiftCoverageSnapshot.Policy
    ) -> [ShiftCoverageCommand.Action] {
        switch item.selectionPhase {
        case nil:
            return item.revision == 1 && policy.volunteerWindowMillis != nil ? [.startSelection, .offer] : [.offer]
        case .reserve, .draw: return [.offerNext]
        case .volunteers:
            return nowMillis >= (item.volunteerClosesAtMillis ?? Int64.max) ? [.offerNext] : []
        case .drawRequired:
            guard policy.drawAvailable else { return [] }
            if item.drawCommitted != true { return [.commitDraw] }
            return nowMillis >= (item.drawAvailableAtMillis ?? Int64.max) ? [.revealDraw] : []
        case .adminRequired: return [.offerAdmin]
        }
    }
}
