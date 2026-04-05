import Foundation

actor InMemoryShiftSwapRequestRepository: ShiftSwapRequestRepository {
    private var requests: [String: ShiftSwapRequest] = [:]

    func allShiftSwapRequests() async -> [ShiftSwapRequest] {
        requests.values.sorted { $0.requestedAtMillis > $1.requestedAtMillis }
    }

    func upsert(request: ShiftSwapRequest) async -> ShiftSwapRequest {
        let persisted = ShiftSwapRequest(
            id: request.id.isEmpty ? "swap_\(request.requestedShiftId)_\(request.requesterUserId)" : request.id,
            requestedShiftId: request.requestedShiftId,
            requesterUserId: request.requesterUserId,
            reason: request.reason,
            status: request.status,
            candidates: request.candidates,
            responses: request.responses,
            selectedCandidateUserId: request.selectedCandidateUserId,
            selectedCandidateShiftId: request.selectedCandidateShiftId,
            requestedAtMillis: request.requestedAtMillis,
            confirmedAtMillis: request.confirmedAtMillis,
            appliedAtMillis: request.appliedAtMillis
        )
        requests[persisted.id] = persisted
        return persisted
    }
}
