import Foundation

struct SeasonalCommitment: Identifiable, Equatable, Sendable {
    let id: String
    let userId: String
    let productId: String
    let seasonKey: String
    let fixedQtyPerOfferedWeek: Double
    let active: Bool
    let createdAtMillis: Int64
    let updatedAtMillis: Int64
}
