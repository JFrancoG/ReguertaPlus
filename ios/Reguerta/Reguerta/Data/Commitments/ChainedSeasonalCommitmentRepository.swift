import Foundation

actor ChainedSeasonalCommitmentRepository<
    Primary: SeasonalCommitmentRepository,
    Fallback: SeasonalCommitmentRepository
>: SeasonalCommitmentRepository {
    private let primary: Primary
    private let fallback: Fallback

    init(primary: Primary, fallback: Fallback) {
        self.primary = primary
        self.fallback = fallback
    }

    func activeCommitments(userId: String) async throws -> [SeasonalCommitment] {
        let primaryItems = try await primary.activeCommitments(userId: userId)
        if !primaryItems.isEmpty {
            return primaryItems
        }
        return try await fallback.activeCommitments(userId: userId)
    }
}
