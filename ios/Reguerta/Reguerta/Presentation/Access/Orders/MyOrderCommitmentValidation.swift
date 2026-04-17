import Foundation

let ecoBasketOptionPickup = "pickup"
let ecoBasketOptionNoPickup = "no_pickup"

struct MyOrderCheckoutValidationResult: Equatable {
    let missingCommitmentProductNames: [String]
    let exceededCommitmentProductNames: [String]
    let incompatibleCommitmentProductNames: [String]
    let hasEcoBasketPriceMismatch: Bool

    var isValid: Bool {
        missingCommitmentProductNames.isEmpty &&
            exceededCommitmentProductNames.isEmpty &&
            incompatibleCommitmentProductNames.isEmpty &&
            !hasEcoBasketPriceMismatch
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
    var missingSeasonalNames: [String] = []
    var exceededSeasonalNames: [String] = []
    var incompatibleSeasonalNames: [String] = []

    for requirement in requiredSeasonalProducts {
        guard requirement.isRepresentableBySelectionStep else {
            incompatibleSeasonalNames.append(requirement.product.name)
            continue
        }

        let selectedUnits = selectedQuantities[requirement.product.id, default: 0]
        let selectedQuantity = Double(selectedUnits) * requirement.selectionStep
        if selectedQuantity + seasonalCommitmentTolerance < requirement.requiredQuantity {
            missingSeasonalNames.append(requirement.product.name)
            continue
        }
        if selectedQuantity - seasonalCommitmentTolerance > requirement.requiredQuantity {
            exceededSeasonalNames.append(requirement.product.name)
        }
    }
    let missingNames = deduplicatePreservingOrder(missingEcoNames + missingSeasonalNames)
    let exceededNames = deduplicatePreservingOrder(exceededSeasonalNames)
    let incompatibleNames = deduplicatePreservingOrder(incompatibleSeasonalNames)

    let distinctEcoBasketPrices = Set(
        products
            .filter(\.isEcoBasket)
            .filter(\.isVisibleInOrdering)
            .map(\.normalizedEcoBasketPriceKey)
    )

    return MyOrderCheckoutValidationResult(
        missingCommitmentProductNames: missingNames,
        exceededCommitmentProductNames: exceededNames,
        incompatibleCommitmentProductNames: incompatibleNames,
        hasEcoBasketPriceMismatch: distinctEcoBasketPrices.count > 1
    )
}

func seasonalCommitmentUnitLimitsByProductID(
    products: [Product],
    seasonalCommitments: [SeasonalCommitment]
) -> [String: Int] {
    requiredSeasonalCommitmentProducts(products: products, seasonalCommitments: seasonalCommitments)
        .reduce(into: [String: Int]()) { partialResult, requirement in
            guard requirement.isRepresentableBySelectionStep else { return }
            let expectedUnits = requirement.requiredQuantity / requirement.selectionStep
            let requiredUnits = Int(expectedUnits.rounded())
            if requiredUnits > 0 {
                partialResult[requirement.product.id] = requiredUnits
            }
        }
}

private func requiredEcoBasketCommitmentProducts(
    currentMember: Member?,
    members: [Member],
    products: [Product],
    currentWeekParity: ProducerParity
) -> [Product] {
    guard let member = currentMember,
          member.isActive,
          member.isMember
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
                    producer.isProducer &&
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
    let requiredQuantity: Double
    let selectionStep: Double
    let isRepresentableBySelectionStep: Bool
}

private struct SeasonalVisibleProductsIndex {
    let byID: [String: Product]
    let byNormalizedName: [String: Product]
    let withNormalizedName: [(product: Product, normalizedName: String)]
}

private func requiredSeasonalCommitmentProducts(
    products: [Product],
    seasonalCommitments: [SeasonalCommitment]
) -> [SeasonalProductRequirement] {
    guard !seasonalCommitments.isEmpty else {
        return []
    }

    let index = buildSeasonalVisibleProductsIndex(products: products)
    let requiredQuantityByProductID = mergeRequiredSeasonalQuantities(
        commitments: seasonalCommitments,
        index: index
    )
    return buildSeasonalRequirements(
        requiredQuantityByProductID: requiredQuantityByProductID,
        productsByID: index.byID
    )
}

private func buildSeasonalVisibleProductsIndex(products: [Product]) -> SeasonalVisibleProductsIndex {
    let visibleProducts = products
        .filter(\.isVisibleInOrdering)
        .sorted { lhs, rhs in
            if lhs.companyName.localizedCaseInsensitiveCompare(rhs.companyName) != .orderedSame {
                return lhs.companyName.localizedCaseInsensitiveCompare(rhs.companyName) == .orderedAscending
            }
            return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
        }
    let byID = Dictionary(uniqueKeysWithValues: visibleProducts.map { ($0.id, $0) })
    let byNormalizedName = visibleProducts.reduce(into: [String: Product]()) { partialResult, product in
        let key = product.name.commitmentNormalized()
        if partialResult[key] == nil {
            partialResult[key] = product
        }
    }
    let withNormalizedName = visibleProducts.map { ($0, $0.name.commitmentNormalized()) }

    return SeasonalVisibleProductsIndex(
        byID: byID,
        byNormalizedName: byNormalizedName,
        withNormalizedName: withNormalizedName
    )
}

private func mergeRequiredSeasonalQuantities(
    commitments: [SeasonalCommitment],
    index: SeasonalVisibleProductsIndex
) -> [String: Double] {
    var requiredQuantityByProductID: [String: Double] = [:]

    for commitment in commitments where commitment.active {
        guard let matchedProductID = resolveSeasonalMatchedProductID(
            commitment: commitment,
            index: index
        ) else {
            continue
        }

        let requiredQuantity = commitment.fixedQtyPerOfferedWeek
        let existingQuantity = requiredQuantityByProductID[matchedProductID] ?? 0
        requiredQuantityByProductID[matchedProductID] = max(existingQuantity, requiredQuantity)
    }

    return requiredQuantityByProductID
}

private func resolveSeasonalMatchedProductID(
    commitment: SeasonalCommitment,
    index: SeasonalVisibleProductsIndex
) -> String? {
    index.byID[commitment.productId]?.id ??
        commitment.productNameHint
        .map { $0.commitmentNormalized() }
        .flatMap { index.byNormalizedName[$0]?.id } ??
        commitment.commitmentSearchTerms().compactMap { term in
            index.withNormalizedName.first { _, normalizedName in
                normalizedName.contains(term) || term.contains(normalizedName)
            }?.product.id
        }.first
}

private func buildSeasonalRequirements(
    requiredQuantityByProductID: [String: Double],
    productsByID: [String: Product]
) -> [SeasonalProductRequirement] {
    requiredQuantityByProductID
        .compactMap { productID, requiredQuantity in
            guard requiredQuantity > 0 else { return nil }
            guard let product = productsByID[productID] else { return nil }

            let step = product.commitmentSelectionStep
            let expectedUnits = requiredQuantity / step
            let roundedUnits = expectedUnits.rounded()
            let isRepresentable = abs(expectedUnits - roundedUnits) <= seasonalCommitmentTolerance

            return SeasonalProductRequirement(
                product: product,
                requiredQuantity: requiredQuantity,
                selectionStep: step,
                isRepresentableBySelectionStep: isRepresentable
            )
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

    var commitmentSelectionStep: Double {
        if pricingMode == .weight {
            return unitQty > 0 ? unitQty : 1
        }
        return 1
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
        let rawTerms = rawValues
            .compactMap { $0 }
            .flatMap { value in value.commitmentTokens() }
        let seasonAliasTerms = seasonKey.commitmentSeasonAliasTerms()
        return (rawTerms + seasonAliasTerms).filter { seen.insert($0).inserted }
    }
}

private extension String {
    func commitmentSeasonAliasTerms() -> [String] {
        let firstToken = components(separatedBy: CharacterSet.alphanumerics.inverted)
            .map { $0.commitmentNormalized() }
            .first { !$0.isEmpty }

        switch firstToken {
        case "avo", "avocado", "avocados", "aguacate", "aguacates":
            return ["aguacate", "aguacates", "avocado", "avocados"]
        case "man", "mango", "mangos":
            return ["mango", "mangos"]
        default:
            return []
        }
    }
}

private let seasonalCommitmentTolerance = 0.0001
