import Foundation

actor InMemoryShiftSwapRequestRepository: ShiftSwapRequestRepository {
    private var requests: [String: ShiftSwapRequest] = [:]

    func allShiftSwapRequests(environment _: SessionEnvironment) async -> [ShiftSwapRequest] {
        requests.values.sorted { $0.requestedAtMillis > $1.requestedAtMillis }
    }

    func upsert(request: ShiftSwapRequest, environment _: SessionEnvironment) async -> ShiftSwapRequest {
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

    func transition(
        _ transition: ShiftSwapTransition,
        environment: SessionEnvironment
    ) async throws -> ShiftSwapTransitionResult {
        let request: ShiftSwapRequest
        switch transition {
        case .create(let value), .respond(let value, _, _), .cancel(let value), .apply(let value, _):
            request = value
        }
        let persisted = await upsert(request: request, environment: environment)
        return ShiftSwapTransitionResult(
            requestId: persisted.id,
            candidateCount: transition.candidateCount
        )
    }
}

private extension ShiftSwapTransition {
    nonisolated var candidateCount: Int? {
        guard case .create(let request) = self else { return nil }
        return request.candidates.count
    }
}
