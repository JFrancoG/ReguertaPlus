import Foundation

protocol SeasonalCommitmentRepository: Sendable {
    func activeCommitments(userId: String) async throws -> [SeasonalCommitment]
}
