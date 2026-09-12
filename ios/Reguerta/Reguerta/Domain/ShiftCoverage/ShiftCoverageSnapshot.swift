struct ShiftCoverageSnapshot: Decodable, Equatable {
    let schemaVersion: Int
    let environment: String
    let memberId: String
    let isAdmin: Bool
    let eligible: Bool
    let serverTimeMillis: Int64
    let policyRevision: String
    let policy: Policy
    let cases: [Case]
    let credits: [Credit]
    let reserves: [Reserve]

    enum Kind: String, Decodable { case delivery, market }
    enum Status: String, Decodable { case open, offered, accepted, completed, cancelled, failed }
    enum Phase: String, Decodable { case reserve, volunteers, drawRequired, draw, adminRequired }
    enum OfferSource: String, Decodable { case admin, reserve, volunteer, draw }
    enum CreditState: String, Decodable { case pending, consumed }

    struct Policy: Decodable, Equatable {
        let maximumOfferWindowMillis: Int64
        let volunteerWindowMillis: Int64?
        let drawAvailable: Bool
    }

    struct Case: Decodable, Equatable, Identifiable {
        let caseId: String
        let shiftId: String
        let type: Kind
        let positionIndex: Int
        let status: Status
        let revision: Int64
        let shiftRevision: Int64
        let scheduledAtMillis: Int64
        let writable: Bool
        let absentUserId: String
        let acceptedUserId: String?
        let offer: Offer?
        let selectionPhase: Phase?
        let volunteerClosesAtMillis: Int64?
        let volunteered: Bool
        let updatedAtMillis: Int64
        let administration: Administration?

        var id: String { caseId }
    }

    struct Offer: Decodable, Equatable {
        let userId: String
        let source: OfferSource
        let expiresAtMillis: Int64
    }

    struct Administration: Decodable, Equatable {
        let openedByUserId: String
        let reason: String
        let volunteerCount: Int
    }

    struct Credit: Decodable, Equatable {
        let creditId: String
        let shiftId: String
        let type: Kind
        let state: CreditState
        let earnedAtMillis: Int64
        let consumedAtMillis: Int64?
    }

    struct Reserve: Decodable, Equatable {
        let type: Kind
        let active: Bool
        let enteredAtMillis: Int64
    }
}

/// Authorization revisions must change on logout/relogin, UID, member, environment or role changes.
/// Tokens belong to the Data adapter and are never retained by presentation state.
struct ShiftCoverageSession: Equatable {
    let uid: String
    let memberId: String
    let authorizationRevision: UInt64
}

enum ShiftCoverageFailure: Error, Equatable {
    case sessionChanged
    case localOnly
    case invalidResponse
    case unavailable
    case rejected(status: Int, code: String)
}

@MainActor
protocol ShiftCoverageRepository {
    func read(caseId: String?, session: ShiftCoverageSession) async throws -> ShiftCoverageSnapshot
    func execute(_ command: ShiftCoverageCommand, session: ShiftCoverageSession) async throws
}
