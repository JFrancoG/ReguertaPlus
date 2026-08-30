import Foundation

protocol ShiftPlanningRequestRepository: Sendable {
    func submit(request: ShiftPlanningRequest, environment: SessionEnvironment) async throws -> ShiftPlanningRequest

    func observeLatestV2Request(
        environment: SessionEnvironment
    ) async -> AsyncThrowingStream<ShiftPlanningRequestObservation?, any Error>

    func stagedCandidate(
        reference: ShiftPlanningCandidateReference
    ) async throws -> ShiftPlanningCandidate
}

extension ShiftPlanningRequestRepository {
    func observeLatestV2Request(
        environment _: SessionEnvironment
    ) async -> AsyncThrowingStream<ShiftPlanningRequestObservation?, any Error> {
        AsyncThrowingStream { continuation in
            continuation.finish()
        }
    }

    func stagedCandidate(reference _: ShiftPlanningCandidateReference) async throws -> ShiftPlanningCandidate {
        throw RepositoryError.invalidData(resource: "shiftPlanningCandidates.unavailable")
    }
}
