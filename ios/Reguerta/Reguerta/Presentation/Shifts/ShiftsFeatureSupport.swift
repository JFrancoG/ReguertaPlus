import Foundation

struct ShiftSwapDraft: Equatable {
    var shiftId = ""
    var reason = ""
}

struct ShiftSwapCreateSubmission {
    let draft: ShiftSwapDraft
    let requestedShiftId: String
    let reason: String
}

enum ShiftSwapAcknowledgement: Equatable, Sendable {
    case create(requestedShiftId: String)
    case respond(
        userId: String,
        candidateShiftId: String,
        response: ShiftSwapResponseStatus
    )
    case cancel
    case apply

    func isReflected(in request: ShiftSwapRequest) -> Bool {
        switch self {
        case .create(let requestedShiftId):
            request.requestedShiftId == requestedShiftId
        case .respond(let userId, let candidateShiftId, let response):
            request.responses.contains {
                $0.userId == userId &&
                    $0.shiftId == candidateShiftId &&
                    $0.status == response
            }
        case .cancel:
            request.status == .cancelled
        case .apply:
            request.status == .applied
        }
    }

    func blocksCreate(for shiftId: String) -> Bool {
        guard case .create(let requestedShiftId) = self else { return false }
        return requestedShiftId == shiftId
    }
}

struct ShiftBoardWindow: Equatable {
    let highlightedShiftId: String?

    var targetShiftId: String? {
        highlightedShiftId
    }

    func highlights(_ shift: ShiftAssignment) -> Bool { shift.id == highlightedShiftId }
}

struct ShiftSwapResponseOption: Equatable {
    let request: ShiftSwapRequest
    let candidate: ShiftSwapCandidate
    let response: ShiftSwapResponse

    var id: String {
        "\(request.id):\(candidate.userId):\(candidate.shiftId)"
    }
}

struct VisibleShiftSwapActivity {
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

extension Array where Element == ShiftAssignment {
    func nextAssignedShift(memberId: String, type: ShiftType, nowMillis: Int64) -> ShiftAssignment? {
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
        let requesterOpen = filter { $0.requesterUserId == currentMemberId && $0.status == .open }
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
            request.status != .open && !dismissedRequestIds.contains(request.id)
            && (
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

func localizedShiftNotificationDateTime(_ millis: Int64) -> String {
    let formatter = DateFormatter()
    formatter.dateStyle = .medium
    formatter.timeStyle = .none
    return formatter.string(from: Date(timeIntervalSince1970: TimeInterval(millis) / 1_000))
}

func displayName(for memberId: String, in session: AuthorizedSession) -> String {
    session.members.first(where: { $0.id == memberId })?.displayName ?? memberId
}
