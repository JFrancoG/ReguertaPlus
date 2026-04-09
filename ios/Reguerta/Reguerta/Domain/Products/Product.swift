import Foundation

struct Product: Identifiable, Equatable, Sendable {
    let id: String
    let vendorId: String
    let companyName: String
    let name: String
    let description: String
    let productImageUrl: String?
    let price: Double
    let pricingMode: ProductPricingMode
    let unitName: String
    let unitAbbreviation: String?
    let unitPlural: String
    let unitQty: Double
    let packContainerName: String?
    let packContainerAbbreviation: String?
    let packContainerPlural: String?
    let packContainerQty: Double?
    let isAvailable: Bool
    let stockMode: ProductStockMode
    let stockQty: Double?
    let isEcoBasket: Bool
    let isCommonPurchase: Bool
    let commonPurchaseType: CommonPurchaseType?
    let archived: Bool
    let createdAtMillis: Int64
    let updatedAtMillis: Int64

    var isVisibleInOrdering: Bool {
        !archived && isAvailable
    }
}

enum ProductPricingMode: String, Equatable, Sendable {
    case fixed
    case weight
}

enum ProductStockMode: String, Equatable, Sendable {
    case finite
    case infinite
}

enum CommonPurchaseType: String, Equatable, Sendable, CaseIterable {
    case seasonal
    case spot
}
