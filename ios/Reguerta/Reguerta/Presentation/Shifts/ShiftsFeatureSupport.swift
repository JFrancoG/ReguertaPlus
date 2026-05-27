import Foundation

struct ShiftSwapDraft: Equatable, Sendable {
    var shiftId = ""
    var reason = ""
}

struct ShiftBoardWindow: Equatable, Sendable {
    let highlightedShiftId: String?

    var targetShiftId: String? {
        highlightedShiftId
    }

    func highlights(_ shift: ShiftAssignment) -> Bool {
        shift.id == highlightedShiftId
    }
}

struct ShiftSwapResponseOption: Equatable, Sendable {
    let request: ShiftSwapRequest
    let candidate: ShiftSwapCandidate
    let response: ShiftSwapResponse

    var id: String {
        "\(request.id):\(candidate.userId):\(candidate.shiftId)"
    }
}

struct VisibleShiftSwapActivity: Sendable {
    let incoming: [(ShiftSwapRequest, ShiftSwapCandidate)]
    let availableResponses: [ShiftSwapResponseOption]
    let outgoing: [ShiftSwapRequest]
    let history: [ShiftSwapRequest]

    var hasContent: Bool {
        !incoming.isEmpty ||
            !availableResponses.isEmpty ||
            !outgoing.isEmpty ||
            !history.isEmpty
    }
}

struct ConfirmShiftSwapContext {
    let session: AuthorizedSession
    let request: ShiftSwapRequest
    let requestedShift: ShiftAssignment
    let candidate: ShiftSwapCandidate
    let candidateShift: ShiftAssignment
}

extension Array where Element == ShiftAssignment {
    func nextAssignedShift(
        memberId: String,
        type: ShiftType,
        nowMillis: Int64
    ) -> ShiftAssignment? {
        self
            .filter { $0.type == type && $0.dateMillis >= nowMillis && $0.isAssigned(to: memberId) }
            .min { $0.dateMillis < $1.dateMillis }
    }
}

extension Array where Element == ShiftSwapRequest {
    func visible(to memberId: String) -> [ShiftSwapRequest] {
        filter { request in
            request.requesterUserId == memberId || request.candidates.contains(where: { $0.userId == memberId })
        }
            .sorted { $0.requestedAtMillis > $1.requestedAtMillis }
    }

    func visibleShiftSwapActivity(
        currentMemberId: String?,
        dismissedRequestIds: Set<String>
    ) -> VisibleShiftSwapActivity {
        guard let currentMemberId else {
            return VisibleShiftSwapActivity(
                incoming: [],
                availableResponses: [],
                outgoing: [],
                history: []
            )
        }

        let incoming = flatMap { request in
            request.candidates
                .filter { $0.userId == currentMemberId }
                .filter { candidate in
                    request.status == .open &&
                        !request.responses.contains {
                            $0.userId == candidate.userId && $0.shiftId == candidate.shiftId
                        }
                }
                .map { (request, $0) }
        }
        let requesterOpen = filter {
            $0.requesterUserId == currentMemberId && $0.status == .open
        }
        let availableResponses = requesterOpen.flatMap { request in
            request.availableResponses.compactMap { response in
                request.candidates.first {
                    $0.userId == response.userId && $0.shiftId == response.shiftId
                }
                .map {
                    ShiftSwapResponseOption(
                        request: request,
                        candidate: $0,
                        response: response
                    )
                }
            }
        }
        let outgoing = requesterOpen.filter { $0.availableResponses.isEmpty }
        let history = filter { request in
            request.status != .open &&
                !dismissedRequestIds.contains(request.id) &&
                (
                    request.requesterUserId == currentMemberId ||
                        request.candidates.contains { candidate in candidate.userId == currentMemberId }
                )
        }

        return VisibleShiftSwapActivity(
            incoming: incoming,
            availableResponses: availableResponses,
            outgoing: outgoing,
            history: history
        )
    }
}

extension ShiftAssignment {
    func swapCandidates(allShifts: [ShiftAssignment], requesterUserId: String, nowMillis: Int64) -> [ShiftSwapCandidate] {
        let calendar = Calendar(identifier: .iso8601)
        let thresholdDate: Date
        if type == .delivery {
            let nowDate = Date(timeIntervalSince1970: TimeInterval(nowMillis) / 1_000)
            thresholdDate = calendar.date(byAdding: .day, value: 14, to: nowDate) ?? nowDate
        } else {
            thresholdDate = Date(timeIntervalSince1970: TimeInterval(nowMillis) / 1_000)
        }
        let thresholdMillis = Int64(thresholdDate.timeIntervalSince1970 * 1_000)
        return Array(
            allShifts
                .filter { $0.id != id && $0.type == type && $0.dateMillis >= thresholdMillis }
                .flatMap { shift in
                    shift.assignedUserIds
                        .filter { $0 != requesterUserId }
                        .map { ShiftSwapCandidate(userId: $0, shiftId: shift.id) }
                }
                .reduce(into: [String: ShiftSwapCandidate]()) { partialResult, candidate in
                    partialResult["\(candidate.userId):\(candidate.shiftId)"] = candidate
                }
                .values
        )
    }

    func swappingMember(
        with other: ShiftAssignment,
        requesterUserId: String,
        responderUserId: String,
        nowMillis: Int64
    ) -> (ShiftAssignment, ShiftAssignment) {
        func replacing(_ shift: ShiftAssignment, oldUserId: String, newUserId: String) -> ShiftAssignment {
            let updatedAssigned = shift.assignedUserIds.map { $0 == oldUserId ? newUserId : $0 }
            let updatedHelper = shift.helperUserId == oldUserId ? newUserId : shift.helperUserId
            return ShiftAssignment(
                id: shift.id,
                type: shift.type,
                dateMillis: shift.dateMillis,
                assignedUserIds: updatedAssigned,
                helperUserId: updatedHelper,
                status: .confirmed,
                source: "app",
                createdAtMillis: shift.createdAtMillis,
                updatedAtMillis: nowMillis
            )
        }

        return (
            replacing(self, oldUserId: requesterUserId, newUserId: responderUserId),
            replacing(other, oldUserId: responderUserId, newUserId: requesterUserId)
        )
    }
}

extension Array where Element == ShiftAssignment {
    func applyingConfirmedSwap(
        updatedRequestedShift: ShiftAssignment,
        updatedCandidateShift: ShiftAssignment,
        nowMillis: Int64
    ) -> [ShiftAssignment] {
        let replaced = map { shift in
            if shift.id == updatedRequestedShift.id {
                return updatedRequestedShift
            }
            if shift.id == updatedCandidateShift.id {
                return updatedCandidateShift
            }
            return shift
        }

        let deliveries = replaced
            .filter { $0.type == .delivery }
            .sorted { $0.dateMillis < $1.dateMillis }
        let helperByDeliveryId = Dictionary(
            uniqueKeysWithValues: deliveries.enumerated().map { index, shift in
                (shift.id, index + 1 < deliveries.count ? deliveries[index + 1].assignedUserIds.first : nil)
            }
        )

        return replaced.map { shift in
            guard shift.type == .delivery else { return shift }
            let recomputedHelper = helperByDeliveryId[shift.id] ?? nil
            guard shift.helperUserId != recomputedHelper else { return shift }
            return ShiftAssignment(
                id: shift.id,
                type: shift.type,
                dateMillis: shift.dateMillis,
                assignedUserIds: shift.assignedUserIds,
                helperUserId: recomputedHelper,
                status: .confirmed,
                source: "app",
                createdAtMillis: shift.createdAtMillis,
                updatedAtMillis: nowMillis
            )
        }
    }
}

func localizedShiftNotificationDateTime(_ millis: Int64) -> String {
    let formatter = DateFormatter()
    formatter.dateStyle = .medium
    formatter.timeStyle = .none
    return formatter.string(from: Date(timeIntervalSince1970: TimeInterval(millis) / 1_000))
}

func displayName(for memberId: String, in session: AuthorizedSession) -> String {
    session.members.first(where: { $0.id == memberId })?.displayName ?? memberId
}
