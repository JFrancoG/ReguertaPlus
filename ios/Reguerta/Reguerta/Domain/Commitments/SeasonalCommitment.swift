import Foundation

struct SeasonalCommitment: Identifiable, Equatable {
    let id: String
    let userId: String
    let productId: String
    private let storedProductNameHint: String?
    let seasonKey: String
    let fixedQtyPerOfferedWeek: Double
    let active: Bool
    let createdAtMillis: Int64
    let updatedAtMillis: Int64

    var productNameHint: String? { storedProductNameHint }
}

extension SeasonalCommitment {
    init(
        id: String,
        userId: String,
        productId: String,
        productNameHint: String? = nil,
        seasonKey: String,
        fixedQtyPerOfferedWeek: Double,
        active: Bool,
        createdAtMillis: Int64,
        updatedAtMillis: Int64
    ) {
        self.id = id
        self.userId = userId
        self.productId = productId
        self.storedProductNameHint = productNameHint
        self.seasonKey = seasonKey
        self.fixedQtyPerOfferedWeek = fixedQtyPerOfferedWeek
        self.active = active
        self.createdAtMillis = createdAtMillis
        self.updatedAtMillis = updatedAtMillis
    }
}
