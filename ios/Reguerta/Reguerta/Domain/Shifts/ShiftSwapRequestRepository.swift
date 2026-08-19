import Foundation

enum ShiftSwapTransition: Sendable {
    case create(request: ShiftSwapRequest)
    case respond(request: ShiftSwapRequest, candidateShiftId: String, response: ShiftSwapResponseStatus)
    case cancel(request: ShiftSwapRequest)
    case apply(request: ShiftSwapRequest, candidateShiftId: String)
}

struct ShiftSwapTransitionResult: Equatable {
    let requestId: String
    let candidateCount: Int?
}

protocol ShiftSwapRequestRepository: Sendable {
    func allShiftSwapRequests(environment: SessionEnvironment) async throws -> [ShiftSwapRequest]
    func transition(
        _ transition: ShiftSwapTransition,
        environment: SessionEnvironment
    ) async throws -> ShiftSwapTransitionResult
}
