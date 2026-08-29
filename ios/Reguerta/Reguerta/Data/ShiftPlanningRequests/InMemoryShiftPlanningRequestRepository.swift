import Foundation

actor InMemoryShiftPlanningRequestRepository: ShiftPlanningRequestRepository {
    private var requests: [String: ShiftPlanningRequest] = [:]

    func submit(request: ShiftPlanningRequest, environment _: SessionEnvironment) async -> ShiftPlanningRequest {
        let persisted = ShiftPlanningRequest(
            id: request.id.isEmpty ? UUID().uuidString : request.id,
            bundleId: request.bundleId,
            requestedByUserId: request.requestedByUserId,
            requestedAtMillis: request.requestedAtMillis,
            deliveryTargetSeasonStartYear: request.deliveryTargetSeasonStartYear,
            marketTargetSeasonStartYear: request.marketTargetSeasonStartYear
        )
        requests[persisted.id] = persisted
        return persisted
    }
}
