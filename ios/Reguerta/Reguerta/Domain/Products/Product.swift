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
    var weightStep: Double?
    var minWeight: Double?
    var maxWeight: Double?

    var isVisibleInOrdering: Bool {
        !archived && isAvailable
    }
}

extension Product {
    var effectiveWeightStep: Double {
        if let weightStep, weightStep > 0 { return weightStep }
        return unitQty > 0 ? unitQty : 1
    }

    var minimumSelectionCount: Int {
        guard pricingMode == .weight else { return 1 }
        return max(1, Int(ceil((minWeight ?? effectiveWeightStep) / effectiveWeightStep)))
    }

    var maximumSelectionCount: Int? {
        guard pricingMode == .weight, let maxWeight else { return nil }
        return max(minimumSelectionCount, Int(floor(maxWeight / effectiveWeightStep)))
    }

    func selectedQuantity(selectionCount: Int) -> Double {
        pricingMode == .weight ? Double(selectionCount) * effectiveWeightStep : Double(selectionCount)
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
