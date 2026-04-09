import Foundation

actor ChainedSeasonalCommitmentRepository: SeasonalCommitmentRepository {
    private let primary: any SeasonalCommitmentRepository
    private let fallback: any SeasonalCommitmentRepository

    init(primary: any SeasonalCommitmentRepository, fallback: any SeasonalCommitmentRepository) {
        self.primary = primary
        self.fallback = fallback
    }

    func activeCommitments(userId: String) async -> [SeasonalCommitment] {
        let primaryItems = await primary.activeCommitments(userId: userId)
        if !primaryItems.isEmpty {
            return primaryItems
        }
        return await fallback.activeCommitments(userId: userId)
    }
}
