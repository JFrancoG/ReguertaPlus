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
    selectedQuantities: [String: Int],
    selectedEcoBasketOptions: [String: String]
) -> MyOrderCheckoutValidationResult {
    let requiredCommitmentProducts = requiredEcoBasketCommitmentProducts(
        currentMember: currentMember,
        members: members,
        products: products
    )

    let hasRequiredEcoBasket = requiredCommitmentProducts.isEmpty || requiredCommitmentProducts.contains { product in
        let quantity = selectedQuantities[product.id, default: 0]
        guard quantity > 0 else { return false }
        let selectedOption = selectedEcoBasketOptions[product.id]
        return selectedOption == ecoBasketOptionPickup || selectedOption == ecoBasketOptionNoPickup
    }
    let missingNames = hasRequiredEcoBasket ? [] : Array(Set(requiredCommitmentProducts.map(\.name))).sorted()

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
    products: [Product]
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

        let parityProducts = ecoBasketProducts.filter { product in
            eligibleProducerIds.contains(product.vendorId)
        }
        return parityProducts.isEmpty ? ecoBasketProducts : parityProducts
    }
}

private extension Product {
    var normalizedEcoBasketPriceKey: Int {
        Int((price * 10_000).rounded())
    }
}
