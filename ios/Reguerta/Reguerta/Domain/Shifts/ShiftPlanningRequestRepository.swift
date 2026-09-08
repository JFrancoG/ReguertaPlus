import Foundation

protocol ShiftPlanningRequestRepository: Sendable {
    func submit(request: ShiftPlanningRequest, environment: SessionEnvironment) async throws -> ShiftPlanningRequest

    /// Follows one selected request, or discovers the administrator's latest v2 request when no ID is selected.
    func observeV2Request(
        environment: SessionEnvironment,
        requestedByUserID: String,
        requestID: String?
    ) async -> AsyncThrowingStream<ShiftPlanningRequestObservation?, any Error>

    func stagedCandidate(
        reference: ShiftPlanningCandidateReference
    ) async throws -> ShiftPlanningCandidate
}

extension ShiftPlanningRequestRepository {
    func observeV2Request(
        environment _: SessionEnvironment,
        requestedByUserID _: String,
        requestID _: String?
    ) async -> AsyncThrowingStream<ShiftPlanningRequestObservation?, any Error> {
        AsyncThrowingStream { continuation in
            continuation.finish()
        }
    }

    func stagedCandidate(reference _: ShiftPlanningCandidateReference) async throws -> ShiftPlanningCandidate {
        throw RepositoryError.invalidData(resource: "shiftPlanningCandidates.unavailable")
    }
}
