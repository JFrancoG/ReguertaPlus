import Foundation

struct ChainedShiftPlanningRequestRepository<
    Primary: ShiftPlanningRequestRepository,
    Fallback: ShiftPlanningRequestRepository
>: ShiftPlanningRequestRepository {
    let primary: Primary
    let fallback: Fallback

    func submit(request: ShiftPlanningRequest) async throws -> ShiftPlanningRequest {
        try await primary.submit(request: request)
    }
}
