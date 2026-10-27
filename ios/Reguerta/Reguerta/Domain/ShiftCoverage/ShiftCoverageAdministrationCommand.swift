/// An immutable administrative intent survives an uncertain response unchanged. The actor comes only from
/// authentication. Spacing authorizes the exact backend proposal; it never edits an assignment or member account.
struct ShiftCoverageAdministrationCommand: Encodable, Equatable {
    let operationId: String
    let userId: String
    let intent: Intent

    enum Intent: Equatable {
        case membership(expectedRevision: Int64, contextDigest: String, permanentDepartureReason: String?)
        case spacing(candidate: ShiftCoverageAdministrationSnapshot.SpacingCandidate, reason: String)
    }

    var action: String {
        switch intent {
        case .membership: "reconcileMembership"
        case .spacing: "authorizeDeliverySpacingException"
        }
    }

    private enum CodingKeys: CodingKey {
        case schemaVersion, environment, action, operationId, userId, expectedRevision, expectedContextDigest
        case permanentDepartureReason, proposalId, planningRequestId, previousDate, previousRoundNumber
        case date, roundNumber, reason
    }

    func encode(to encoder: any Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encode(1, forKey: .schemaVersion)
        try values.encode("develop", forKey: .environment)
        try values.encode(action, forKey: .action)
        try values.encode(operationId, forKey: .operationId)
        try values.encode(userId, forKey: .userId)
        switch intent {
        case let .membership(revision, contextDigest, reason):
            try values.encode(revision, forKey: .expectedRevision)
            try values.encode(contextDigest, forKey: .expectedContextDigest)
            try values.encodeIfPresent(reason, forKey: .permanentDepartureReason)
        case let .spacing(candidate, reason):
            try values.encode(candidate.id, forKey: .proposalId)
            try values.encode(candidate.contextDigest, forKey: .expectedContextDigest)
            try values.encode(candidate.planningRequestId, forKey: .planningRequestId)
            try values.encode(candidate.previousDate, forKey: .previousDate)
            try values.encode(candidate.previousRoundNumber, forKey: .previousRoundNumber)
            try values.encode(candidate.date, forKey: .date)
            try values.encode(candidate.roundNumber, forKey: .roundNumber)
            try values.encode(reason, forKey: .reason)
        }
    }
}
