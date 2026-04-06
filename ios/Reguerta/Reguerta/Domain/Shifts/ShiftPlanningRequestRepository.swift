import Foundation

protocol ShiftPlanningRequestRepository: Sendable {
    func submit(request: ShiftPlanningRequest) async -> ShiftPlanningRequest
}
