import Foundation

enum ShiftSwapTransition: Sendable {
    case create(request: ShiftSwapRequest)
    case respond(request: ShiftSwapRequest, candidateShiftId: String, response: ShiftSwapResponseStatus)
    case cancel(request: ShiftSwapRequest)
    case apply(request: ShiftSwapRequest, candidateShiftId: String)
}

struct ShiftSwapTransitionResult: Equatable, Sendable {
    let requestId: String
    let candidateCount: Int?
}

protocol ShiftSwapRequestRepository: Sendable {
    func allShiftSwapRequests() async throws -> [ShiftSwapRequest]
    func transition(_ transition: ShiftSwapTransition) async throws -> ShiftSwapTransitionResult
}
