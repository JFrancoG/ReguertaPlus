import Foundation

let ecoBasketOptionPickup = "pickup"
let ecoBasketOptionNoPickup = "no_pickup"

struct MyOrderCheckoutValidationResult: Equatable {
    let missingCommitmentProductNames: [String]
    let hasEcoBasketPriceMismatch: Bool

    var isValid: Bool {
        missingCommitmentProductNames.isEmpty && !hasEcoBasketPriceMismatch
    }
}

func validateMyOrderCheckout(
    currentMember: Member?,
    members: [Member],
    products: [Product],
    seasonalCommitments: [SeasonalCommitment] = [],
    selectedQuantities: [String: Int],
    selectedEcoBasketOptions: [String: String],
    currentWeekParity: ProducerParity = currentISOWeekProducerParity()
) -> MyOrderCheckoutValidationResult {
    let requiredEcoBasketProducts = requiredEcoBasketCommitmentProducts(
        currentMember: currentMember,
        members: members,
        products: products,
        currentWeekParity: currentWeekParity
    )
    let requiredSeasonalProducts = requiredSeasonalCommitmentProducts(
        products: products,
        seasonalCommitments: seasonalCommitments
    )

    let hasRequiredEcoBasket = requiredEcoBasketProducts.isEmpty || requiredEcoBasketProducts.contains { product in
        let quantity = selectedQuantities[product.id, default: 0]
        guard quantity > 0 else { return false }
        let selectedOption = selectedEcoBasketOptions[product.id]
        return selectedOption == ecoBasketOptionPickup || selectedOption == ecoBasketOptionNoPickup
    }

    let missingEcoNames = hasRequiredEcoBasket ? [] : requiredEcoBasketProducts.map(\.name)
    let missingSeasonalNames = requiredSeasonalProducts.compactMap { requirement -> String? in
        selectedQuantities[requirement.product.id, default: 0] < requirement.requiredUnits
            ? requirement.product.name
            : nil
    }
    let missingNames = deduplicatePreservingOrder(missingEcoNames + missingSeasonalNames)

    let distinctEcoBasketPrices = Set(
        products
            .filter(\.isEcoBasket)
            .filter(\.isVisibleInOrdering)
            .map(\.normalizedEcoBasketPriceKey)
    )

    return MyOrderCheckoutValidationResult(
        missingCommitmentProductNames: missingNames,
        hasEcoBasketPriceMismatch: distinctEcoBasketPrices.count > 1
    )
}

private func requiredEcoBasketCommitmentProducts(
    currentMember: Member?,
    members: [Member],
    products: [Product],
    currentWeekParity: ProducerParity
) -> [Product] {
    guard let member = currentMember,
          member.isActive,
          member.roles.contains(.member)
    else {
        return []
    }

    let ecoBasketProducts = products
        .filter(\.isEcoBasket)
        .filter(\.isVisibleInOrdering)

    guard !ecoBasketProducts.isEmpty else {
        return []
    }

    switch member.ecoCommitmentMode {
    case .weekly:
        return ecoBasketProducts
    case .biweekly:
        guard let parity = member.ecoCommitmentParity else {
            return ecoBasketProducts
        }
        guard parity == currentWeekParity else {
            return []
        }

        let eligibleProducerIds = Set(
            members
                .filter { producer in
                    producer.roles.contains(.producer) &&
                        producer.isActive &&
                        producer.producerCatalogEnabled &&
                        producer.producerParity == parity
                }
                .map(\.id)
        )

        return ecoBasketProducts.filter { product in
            eligibleProducerIds.contains(product.vendorId)
        }
    }
}

private struct SeasonalProductRequirement {
    let product: Product
    let requiredUnits: Int
}

private func requiredSeasonalCommitmentProducts(
    products: [Product],
    seasonalCommitments: [SeasonalCommitment]
) -> [SeasonalProductRequirement] {
    guard !seasonalCommitments.isEmpty else {
        return []
    }

    let visibleProducts = products
        .filter(\.isVisibleInOrdering)
        .sorted { lhs, rhs in
            if lhs.companyName.localizedCaseInsensitiveCompare(rhs.companyName) != .orderedSame {
                return lhs.companyName.localizedCaseInsensitiveCompare(rhs.companyName) == .orderedAscending
            }
            return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
        }
    let visibleProductsById = Dictionary(uniqueKeysWithValues: visibleProducts.map { ($0.id, $0) })
    let visibleProductsByName = visibleProducts.reduce(into: [String: Product]()) { partialResult, product in
        let key = product.name.commitmentNormalized()
        if partialResult[key] == nil {
            partialResult[key] = product
        }
    }
    let visibleProductsWithNormalizedName = visibleProducts.map { ($0, $0.name.commitmentNormalized()) }

    var requiredUnitsByProductId: [String: Int] = [:]

    for commitment in seasonalCommitments where commitment.active {
        let matchedProductID = visibleProductsById[commitment.productId]?.id ??
            commitment.productNameHint
                .map { $0.commitmentNormalized() }
                .flatMap { visibleProductsByName[$0]?.id } ??
            commitment.commitmentSearchTerms().compactMap { term in
                visibleProductsWithNormalizedName.first { _, normalizedName in
                    normalizedName.contains(term) || term.contains(normalizedName)
                }?.0.id
            }.first
        guard let matchedProductID else {
            continue
        }
        let requiredUnits = max(1, Int(ceil(commitment.fixedQtyPerOfferedWeek)))
        let existingUnits = requiredUnitsByProductId[matchedProductID] ?? 0
        requiredUnitsByProductId[matchedProductID] = max(existingUnits, requiredUnits)
    }

    return requiredUnitsByProductId
        .compactMap { productId, requiredUnits in
            guard let product = visibleProductsById[productId] else {
                return nil
            }
            return SeasonalProductRequirement(product: product, requiredUnits: requiredUnits)
        }
        .sorted { lhs, rhs in
            if lhs.product.companyName.localizedCaseInsensitiveCompare(rhs.product.companyName) != .orderedSame {
                return lhs.product.companyName.localizedCaseInsensitiveCompare(rhs.product.companyName) == .orderedAscending
            }
            return lhs.product.name.localizedCaseInsensitiveCompare(rhs.product.name) == .orderedAscending
        }
}

private func deduplicatePreservingOrder(_ values: [String]) -> [String] {
    var seen = Set<String>()
    return values.filter { seen.insert($0).inserted }
}

private extension Product {
    var normalizedEcoBasketPriceKey: Int {
        Int((price * 10_000).rounded())
    }
}

private extension String {
    func commitmentNormalized() -> String {
        folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    func commitmentTokens() -> [String] {
        components(separatedBy: CharacterSet.alphanumerics.inverted)
            .map { $0.commitmentNormalized() }
            .filter { token in
                token.count >= 4 && token.contains(where: \.isLetter)
            }
    }
}

private extension SeasonalCommitment {
    func commitmentSearchTerms() -> [String] {
        var seen = Set<String>()
        let rawValues: [String?] = [productNameHint, seasonKey, productId]
        return rawValues
            .compactMap { $0 }
            .flatMap { value in value.commitmentTokens() }
            .filter { seen.insert($0).inserted }
    }
}
