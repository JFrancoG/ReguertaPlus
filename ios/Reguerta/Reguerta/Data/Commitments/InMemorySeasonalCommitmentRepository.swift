import Foundation

actor InMemorySeasonalCommitmentRepository: SeasonalCommitmentRepository {
    private var commitmentsById: [String: SeasonalCommitment]

    init(items: [SeasonalCommitment] = []) {
        self.commitmentsById = Dictionary(uniqueKeysWithValues: items.map { ($0.id, $0) })
    }

    func activeCommitments(userId: String) async -> [SeasonalCommitment] {
        commitmentsById.values
            .filter { $0.userId == userId && $0.active }
            .sorted {
                if $0.seasonKey.localizedCaseInsensitiveCompare($1.seasonKey) != .orderedSame {
                    return $0.seasonKey.localizedCaseInsensitiveCompare($1.seasonKey) == .orderedAscending
                }
                return $0.productId.localizedCaseInsensitiveCompare($1.productId) == .orderedAscending
            }
    }
}
