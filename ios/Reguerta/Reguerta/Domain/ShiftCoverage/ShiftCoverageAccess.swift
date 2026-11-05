/// The backend admits one authenticated member and environment under one operational policy.
/// A disabled response never grants permission to issue overview, administrative or mutation requests.
struct ShiftCoverageAccess: Decodable, Equatable {
    let schemaVersion: Int
    let environment: SessionEnvironment
    let memberId: String
    let enabled: Bool
    let policyRevision: String?
}
