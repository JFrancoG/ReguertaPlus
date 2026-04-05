import Foundation

enum ShiftSwapRequestStatus: String, Equatable, Sendable {
    case open
    case cancelled
    case applied
}

enum ShiftSwapResponseStatus: String, Equatable, Sendable {
    case available
    case unavailable
}

struct ShiftSwapCandidate: Equatable, Sendable {
    let userId: String
    let shiftId: String
}

struct ShiftSwapResponse: Equatable, Sendable {
    let userId: String
    let shiftId: String
    let status: ShiftSwapResponseStatus
    let respondedAtMillis: Int64
}

struct ShiftSwapRequest: Identifiable, Equatable, Sendable {
    let id: String
    let requestedShiftId: String
    let requesterUserId: String
    let reason: String
    let status: ShiftSwapRequestStatus
    let candidates: [ShiftSwapCandidate]
    let responses: [ShiftSwapResponse]
    let selectedCandidateUserId: String?
    let selectedCandidateShiftId: String?
    let requestedAtMillis: Int64
    let confirmedAtMillis: Int64?
    let appliedAtMillis: Int64?
}
