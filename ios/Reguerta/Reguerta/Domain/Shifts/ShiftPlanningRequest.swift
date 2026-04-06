import Foundation

enum ShiftPlanningRequestType: String, Equatable, Sendable {
    case delivery
    case market
}

enum ShiftPlanningRequestStatus: String, Equatable, Sendable {
    case requested
    case processing
    case completed
    case failed
}

struct ShiftPlanningRequest: Identifiable, Equatable, Sendable {
    let id: String
    let type: ShiftPlanningRequestType
    let requestedByUserId: String
    let requestedAtMillis: Int64
    let status: ShiftPlanningRequestStatus
}
