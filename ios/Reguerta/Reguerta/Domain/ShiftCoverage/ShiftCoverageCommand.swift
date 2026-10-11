/// One immutable intent, including its operation ID and expected revisions, survives an uncertain response.
/// Optional action arguments are omitted from JSON; authorization remains exclusively server-owned.
struct ShiftCoverageCommand: Encodable, Equatable {
    let schemaVersion = 1
    let environment = "develop"
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
}
