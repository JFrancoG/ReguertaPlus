import Foundation

protocol SeasonalCommitmentRepository: Sendable {
    func activeCommitments(userId: String, environment: SessionEnvironment) async throws -> [SeasonalCommitment]
}

/// Resolves commitments through the canonical member-document id.
///
/// The stored-data inventory and shared Firestore contract both require `userId == member.id`. A successful empty
/// result therefore means that the member has no active seasonal commitments; it must not trigger identity fallbacks.
func loadActiveCommitments(
    for member: Member,
    using loadForUser: @Sendable (String) async throws -> [SeasonalCommitment]
) async throws -> [SeasonalCommitment] {
    guard let canonicalKey = member.seasonalCommitmentLookupKeys.first else { return [] }
    return try await loadForUser(canonicalKey).normalizedForMemberLookup
}

private extension Array where Element == SeasonalCommitment {
    var normalizedForMemberLookup: [SeasonalCommitment] {
        Dictionary(
            map { ($0.id, $0) },
            uniquingKeysWith: { _, latest in latest }
        ).values.sorted { lhs, rhs in
            if lhs.seasonKey.localizedCaseInsensitiveCompare(rhs.seasonKey) != .orderedSame {
                return lhs.seasonKey.localizedCaseInsensitiveCompare(rhs.seasonKey) == .orderedAscending
            }
            return lhs.productId.localizedCaseInsensitiveCompare(rhs.productId) == .orderedAscending
        }
    }
}
