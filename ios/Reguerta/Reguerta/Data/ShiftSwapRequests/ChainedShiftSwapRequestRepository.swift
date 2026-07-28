import Foundation

struct ChainedShiftSwapRequestRepository: ShiftSwapRequestRepository {
    let primary: any ShiftSwapRequestRepository
    let fallback: any ShiftSwapRequestRepository

    func allShiftSwapRequests() async throws -> [ShiftSwapRequest] {
        try await primary.allShiftSwapRequests()
    }

    func transition(_ transition: ShiftSwapTransition) async throws -> ShiftSwapTransitionResult {
        try await primary.transition(transition)
    }
}
