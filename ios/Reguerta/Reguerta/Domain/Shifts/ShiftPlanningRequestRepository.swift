import Foundation

protocol ShiftPlanningRequestRepository: Sendable {
    func submit(request: ShiftPlanningRequest, environment: SessionEnvironment) async throws -> ShiftPlanningRequest
}
