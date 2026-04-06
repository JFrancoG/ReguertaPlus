import Foundation

actor InMemoryShiftPlanningRequestRepository: ShiftPlanningRequestRepository {
    private var requests: [String: ShiftPlanningRequest] = [:]

    func submit(request: ShiftPlanningRequest) async -> ShiftPlanningRequest {
        let persisted = ShiftPlanningRequest(
            id: request.id.isEmpty ? UUID().uuidString : request.id,
            type: request.type,
            requestedByUserId: request.requestedByUserId,
            requestedAtMillis: request.requestedAtMillis,
            status: request.status
        )
        requests[persisted.id] = persisted
        return persisted
    }
}
