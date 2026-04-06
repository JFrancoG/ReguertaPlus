import Foundation

struct ChainedShiftPlanningRequestRepository: ShiftPlanningRequestRepository {
    let primary: any ShiftPlanningRequestRepository
    let fallback: any ShiftPlanningRequestRepository

    func submit(request: ShiftPlanningRequest) async -> ShiftPlanningRequest {
        let fallbackSaved = await fallback.submit(request: request)
        let primarySaved = await primary.submit(request: fallbackSaved)
        return primarySaved
    }
}
