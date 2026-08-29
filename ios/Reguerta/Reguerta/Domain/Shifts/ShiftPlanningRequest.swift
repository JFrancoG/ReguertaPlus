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

nonisolated struct ShiftPlanningPreviewReference: Equatable {
    let sourceRequestId: String
    let bundleRevision: String
    let bundleDigest: String
}

nonisolated enum ShiftPlanningRequestIntent: Equatable {
    case preview
    case stage(ShiftPlanningPreviewReference)
}

nonisolated struct ShiftPlanningRequest: Identifiable, Equatable {
    let id: String
    let bundleId: String
    let requestedByUserId: String
    let requestedAtMillis: Int64
    let deliveryTargetSeasonStartYear: Int
    let marketTargetSeasonStartYear: Int
    let intent: ShiftPlanningRequestIntent
}
