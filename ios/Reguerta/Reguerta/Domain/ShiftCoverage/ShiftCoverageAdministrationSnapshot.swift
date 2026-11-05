/// Administrative projections belong to one authenticated member. Context digests bind the exact source,
/// reserve, credit and planning evidence reviewed before an action; they confer no authorization.
struct ShiftCoverageAdministrationSnapshot: Decodable, Equatable {
    let schemaVersion: Int
    let environment: String
    let memberId: String
    let isAdmin: Bool
    let serverTimeMillis: Int64
    let policyRevision: String
    let membershipWritable: Bool
    let members: [Member]
    let spacingCandidates: [SpacingCandidate]
    let spacingUnavailableReason: String?

    struct Member: Decodable, Equatable, Identifiable {
        let userId: String
        let displayName: String
        let membershipRevision: Int64
        let sourceActive: Bool?
        let eligible: Bool
        let permanentDeparture: Bool
        let pendingQueueTransition: Bool
        let contextDigest: String
        let reserves: [Reserve]
        let credits: [Credits]
        var id: String { userId }
        var allowsPermanentDeparture: Bool { sourceActive != true && !permanentDeparture }
    }

    struct Reserve: Decodable, Equatable {
        let type: ShiftCoverageSnapshot.Kind
        let active: Bool
        let enteredAtMillis: Int64
        let admissionAfterRound: Int64?
    }

    struct Credits: Decodable, Equatable {
        let type: ShiftCoverageSnapshot.Kind
        let pendingCount: Int
        let consumedCount: Int
        let cancelledCount: Int
    }

    struct SpacingCandidate: Decodable, Equatable, Identifiable {
        let id: String
        let userId: String
        let displayName: String
        let planningRequestId: String
        let previousDate: String
        let previousRoundNumber: Int64
        let date: String
        let roundNumber: Int64
        let contextDigest: String
    }
}
