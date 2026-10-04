import Foundation
import Observation

@MainActor
@Observable
final class CoverageCommandDraft: Identifiable {
    let id = UUID()
    let action: ShiftCoverageCommand.Action
    let item: ShiftCoverageSnapshot.Case?
    let snapshot: ShiftCoverageSnapshot
    let nowMillis: Int64
    var shiftId: String
    var memberId = ""
    var reason = ""
    var deadline: Date

    init(
        action: ShiftCoverageCommand.Action,
        item: ShiftCoverageSnapshot.Case?,
        snapshot: ShiftCoverageSnapshot,
        nowMillis: Int64
    ) {
        self.action = action
        self.item = item
        self.snapshot = snapshot
        self.nowMillis = nowMillis
        shiftId = snapshot.availableShifts?.first(where: \.writable)?.shiftId ?? ""
        deadline = Date(timeIntervalSince1970: Double(min(
            nowMillis + snapshot.policy.maximumOfferWindowMillis,
            (item?.scheduledAtMillis ?? Int64.max) - 1000
        )) / 1000)
    }

    var shifts: [ShiftCoverageSnapshot.AvailableShift] { (snapshot.availableShifts ?? []).filter(\.writable) }
    var selectedShift: ShiftCoverageSnapshot.AvailableShift? { shifts.first { $0.shiftId == shiftId } }
    var needsReason: Bool { [.open, .offer, .offerAdmin, .resumeAdmin, .cancel, .fail].contains(action) }
    var needsMember: Bool { [.open, .offer, .offerAdmin].contains(action) }
    var needsDeadline: Bool { [.offer, .offerAdmin, .offerNext].contains(action) }
    var members: [ShiftCoverageSnapshot.MemberLabel] {
        let all = snapshot.members ?? []
        if action == .open {
            return all.filter { selectedShift?.assignedUserIds.contains($0.memberId) == true }
        }
        return all.filter { $0.offerCandidate == true }
    }

    var command: ShiftCoverageCommand? {
        let trimmed = reason.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !needsReason || (!trimmed.isEmpty && trimmed.count <= 500) else { return nil }
        guard !needsMember || members.contains(where: { $0.memberId == memberId }) else { return nil }
        let expires = Int64(deadline.timeIntervalSince1970 * 1000)
        guard !needsDeadline || (expires > nowMillis && expires <= nowMillis + snapshot.policy.maximumOfferWindowMillis
            && expires < (item?.scheduledAtMillis ?? 0)) else { return nil }
        guard action != .open || selectedShift != nil else { return nil }
        guard action == .open || item != nil else { return nil }
        return ShiftCoverageCommand(
            caseId: item?.caseId ?? id.uuidString,
            operationId: id.uuidString,
            expectedRevision: item?.revision ?? 0,
            expectedShiftRevision: item?.shiftRevision ?? selectedShift?.shiftRevision ?? 0,
            action: action,
            shiftId: action == .open ? shiftId : nil,
            absentUserId: action == .open ? memberId : nil,
            reason: needsReason ? trimmed : nil,
            userId: [.offer, .offerAdmin].contains(action) ? memberId : nil,
            expiresAtMillis: needsDeadline ? expires : nil
        )
    }
}
