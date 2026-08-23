import Foundation

enum ShiftSwapCommand {
    case create(requestedShiftId: String, reason: String)
    case respond(requestId: String, candidateShiftId: String, response: ShiftSwapResponseStatus)
    case cancel(requestId: String)
    case apply(requestId: String, candidateShiftId: String)
}

enum ShiftSwapCommandError: Error, Equatable {
    case noCandidates
    case permissionDenied
    case conflict(code: String)
    case unavailable
    case invalidData
    case unknown
}

struct ShiftSwapTransitionResult: Equatable {
    let requestId: String
    let candidateCount: Int?
}

protocol ShiftSwapRequestRepository: Sendable {
    func allShiftSwapRequests(environment: SessionEnvironment) async throws -> [ShiftSwapRequest]
    func transition(
        _ command: ShiftSwapCommand,
        environment: SessionEnvironment
    ) async throws -> ShiftSwapTransitionResult
}
