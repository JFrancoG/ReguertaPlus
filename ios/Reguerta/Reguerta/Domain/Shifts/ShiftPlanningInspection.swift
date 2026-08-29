import Foundation

nonisolated enum ShiftPlanningMode: String, Equatable {
    case preview
    case stage
    case activate
}

nonisolated struct ShiftPlanningSubplanSummary: Equatable {
    let targetSeasonStartYear: Int
    let generatedShiftCount: Int
    let affectedProjectionSeasonStartYears: [Int]
}

nonisolated struct ShiftPlanningCompletedSummary: Equatable {
    let bundleRevision: String
    let bundleDigest: String
    let delivery: ShiftPlanningSubplanSummary
    let market: ShiftPlanningSubplanSummary
}

nonisolated struct ShiftPlanningFailure: Equatable {
    let scope: String
    let code: String
    let messageKey: String
}

nonisolated struct ShiftPlanningCandidateReference: Equatable {
    let candidateId: String
    let candidateDigest: String
    let bundleRevision: String
    let bundleDigest: String
    let environment: SessionEnvironment
}

nonisolated struct ShiftPlanningRequestObservation: Identifiable, Equatable {
    let id: String
    let bundleId: String
    let requestedByUserId: String
    let requestedAtMillis: Int64
    let mode: ShiftPlanningMode
    let status: ShiftPlanningRequestStatus
    let completedSummary: ShiftPlanningCompletedSummary?
    let failure: ShiftPlanningFailure?
    let candidateReference: ShiftPlanningCandidateReference?
}

nonisolated struct ShiftPlanningCandidatePosition: Identifiable, Equatable {
    let id: String
    let type: ShiftPlanningRequestType
    let scheduledDate: String
    let assignedUserIds: [String]
    let helperUserId: String?
}

nonisolated struct ShiftPlanningCandidate: Identifiable, Equatable {
    let id: String
    let bundleRevision: String
    let bundleDigest: String
    let candidateDigest: String
    let positionDocumentCount: Int
    let assignmentPositionCount: Int
    let positions: [ShiftPlanningCandidatePosition]
}
