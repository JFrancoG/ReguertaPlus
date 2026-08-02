import Foundation

struct ChainedShiftSwapRequestRepository<
    Primary: ShiftSwapRequestRepository,
    Fallback: ShiftSwapRequestRepository
>: ShiftSwapRequestRepository {
    let primary: Primary
    let fallback: Fallback

    func allShiftSwapRequests() async throws -> [ShiftSwapRequest] {
        try await primary.allShiftSwapRequests()
    }

    func transition(_ transition: ShiftSwapTransition) async throws -> ShiftSwapTransitionResult {
        try await primary.transition(transition)
    }
}
