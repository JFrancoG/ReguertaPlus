import Foundation

struct ChainedShiftPlanningRequestRepository: ShiftPlanningRequestRepository {
    let primary: any ShiftPlanningRequestRepository
    let fallback: any ShiftPlanningRequestRepository

    func submit(request: ShiftPlanningRequest) async throws -> ShiftPlanningRequest {
        try await primary.submit(request: request)
    }
}
