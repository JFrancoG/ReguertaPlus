/// One immutable intent, including its operation ID and expected revisions, survives an uncertain response.
/// Optional action arguments are omitted from JSON; authorization remains exclusively server-owned.
/// The expected policy is local admission evidence and is deliberately excluded from the wire contract.
struct ShiftCoverageCommand: Encodable, Equatable {
    let schemaVersion = 1
    let expectedPolicyRevision: String
    let environment: SessionEnvironment
    let caseId: String
    let operationId: String
    let expectedRevision: Int64
    let expectedShiftRevision: Int64
    let action: Action
    var shiftId: String?
    var absentUserId: String?
    var reason: String?
    var userId: String?
    var expiresAtMillis: Int64?

    enum Action: String, Encodable {
        case open, offer, accept, decline, expire, complete, startSelection, volunteer, withdrawVolunteer
        case commitDraw, revealDraw, offerNext, offerAdmin, resumeAdmin, cancel, fail
    }

    private enum CodingKeys: CodingKey {
        case schemaVersion, environment, caseId, operationId, expectedRevision, expectedShiftRevision, action
        case shiftId, absentUserId, reason, userId, expiresAtMillis
    }
}
