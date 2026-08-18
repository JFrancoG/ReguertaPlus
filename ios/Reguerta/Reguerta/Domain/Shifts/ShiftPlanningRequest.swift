import Foundation

nonisolated enum ShiftPlanningRequestType: String, Equatable, Sendable {
    case delivery
    case market
}

nonisolated enum ShiftPlanningRequestStatus: String, Equatable, Sendable {
    case requested
    case processing
    case completed
    case failed
}

nonisolated struct ShiftPlanningRequest: Identifiable, Equatable {
    let id: String
    let type: ShiftPlanningRequestType
    let requestedByUserId: String
    let requestedAtMillis: Int64
    let status: ShiftPlanningRequestStatus
}
