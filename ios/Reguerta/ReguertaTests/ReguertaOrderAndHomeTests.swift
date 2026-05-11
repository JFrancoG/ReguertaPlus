import FirebaseAuth
import Foundation
import Testing

@testable import Reguerta

@MainActor
struct ReguertaOrderAndHomeTests {
    @Test
    func myOrderValidationDoesNotRequireBiweeklyCommitmentOnOppositeWeek() {
        let currentMember = member(
            id: "member_1",
            ecoCommitmentMode: .biweekly,
            ecoCommitmentParity: .even
        )
        let producerEven = producer(id: "producer_even", parity: .even)
        let producerOdd = producer(id: "producer_odd", parity: .odd)
        let ecoOdd = ecoBasketProduct(id: "eco_odd", vendorId: producerOdd.id, name: "Ecocesta impar")

        let result = validateMyOrderCheckout(
            currentMember: currentMember,
            members: [currentMember, producerEven, producerOdd],
            products: [ecoOdd],
            selectedQuantities: [:],
            selectedEcoBasketOptions: [:],
            currentWeekParity: .odd
        )

        #expect(result.isValid == true)
        #expect(result.missingCommitmentProductNames.isEmpty)
    }

    @Test
    func myOrderValidationBlocksMissingSeasonalCommitmentProduct() {
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let producerEven = producer(id: "producer_even", parity: .even)
        let avocados = regularProduct(id: "seasonal_avocado", vendorId: producerEven.id, name: "Aguacates")

        let result = validateMyOrderCheckout(
            currentMember: currentMember,
            members: [currentMember, producerEven],
            products: [avocados],
            seasonalCommitments: [seasonalCommitment(productId: avocados.id, fixedQtyPerOfferedWeek: 1)],
            selectedQuantities: [:],
            selectedEcoBasketOptions: [:],
            currentWeekParity: .even
        )

        #expect(result.isValid == false)
        #expect(result.missingCommitmentProductNames == ["Aguacates"])
    }

    @Test
    func myOrderValidationBlocksExceededSeasonalCommitmentQuantity() {
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let producerEven = producer(id: "producer_even", parity: .even)
        let avocados = regularProduct(id: "seasonal_avocado", vendorId: producerEven.id, name: "Aguacates")

        let result = validateMyOrderCheckout(
            currentMember: currentMember,
            members: [currentMember, producerEven],
            products: [avocados],
            seasonalCommitments: [seasonalCommitment(productId: avocados.id, fixedQtyPerOfferedWeek: 2)],
            selectedQuantities: [avocados.id: 3],
            selectedEcoBasketOptions: [:],
            currentWeekParity: .even
        )

        #expect(result.isValid == false)
        #expect(result.exceededCommitmentProductNames == ["Aguacates"])
    }

    @Test
    func myOrderValidationFlagsIncompatibleSeasonalCommitmentStep() {
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let producerEven = producer(id: "producer_even", parity: .even)
        var avocados = regularProduct(id: "seasonal_avocado", vendorId: producerEven.id, name: "Aguacates")
        avocados = Product(
            id: avocados.id,
            vendorId: avocados.vendorId,
            companyName: avocados.companyName,
            name: avocados.name,
            description: avocados.description,
            productImageUrl: avocados.productImageUrl,
            price: avocados.price,
            pricingMode: .weight,
            unitName: "kg",
            unitAbbreviation: "kg",
            unitPlural: "kg",
            unitQty: 1.0,
            packContainerName: avocados.packContainerName,
            packContainerAbbreviation: avocados.packContainerAbbreviation,
            packContainerPlural: avocados.packContainerPlural,
            packContainerQty: avocados.packContainerQty,
            isAvailable: avocados.isAvailable,
            stockMode: avocados.stockMode,
            stockQty: avocados.stockQty,
            isEcoBasket: avocados.isEcoBasket,
            isCommonPurchase: avocados.isCommonPurchase,
            commonPurchaseType: avocados.commonPurchaseType,
            archived: avocados.archived,
            createdAtMillis: avocados.createdAtMillis,
            updatedAtMillis: avocados.updatedAtMillis
        )

        let result = validateMyOrderCheckout(
            currentMember: currentMember,
            members: [currentMember, producerEven],
            products: [avocados],
            seasonalCommitments: [seasonalCommitment(productId: avocados.id, fixedQtyPerOfferedWeek: 3.5)],
            selectedQuantities: [avocados.id: 3],
            selectedEcoBasketOptions: [:],
            currentWeekParity: .even
        )

        #expect(result.isValid == false)
        #expect(result.incompatibleCommitmentProductNames == ["Aguacates"])
    }

    @Test
    func myOrderValidationIgnoresSeasonalCommitmentWhenProductNotOffered() {
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)

        let result = validateMyOrderCheckout(
            currentMember: currentMember,
            members: [currentMember],
            products: [],
            seasonalCommitments: [seasonalCommitment(productId: "seasonal_hidden", fixedQtyPerOfferedWeek: 1)],
            selectedQuantities: [:],
            selectedEcoBasketOptions: [:],
            currentWeekParity: .even
        )

        #expect(result.isValid == true)
        #expect(result.missingCommitmentProductNames.isEmpty)
    }

    @Test
    func myOrderValidationBlocksMissingSeasonalCommitmentUsingSeasonKeyFallback() {
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let avocados = regularProduct(
            id: "product_common_avocado",
            vendorId: "compras_reguerta",
            name: "Aguacates"
        )

        let result = validateMyOrderCheckout(
            currentMember: currentMember,
            members: [currentMember],
            products: [avocados],
            seasonalCommitments: [
                seasonalCommitment(
                    productId: "legacy_mango_commitment",
                    seasonKey: "2026-aguacate",
                    fixedQtyPerOfferedWeek: 1
                )
            ],
            selectedQuantities: [:],
            selectedEcoBasketOptions: [:],
            currentWeekParity: .even
        )

        #expect(result.isValid == false)
        #expect(result.missingCommitmentProductNames == ["Aguacates"])
    }

    @Test
    func myOrderValidationBlocksMissingSeasonalCommitmentUsingSeasonCodeFallback() {
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let avocados = regularProduct(
            id: "product_common_avocado",
            vendorId: "compras_reguerta",
            name: "Aguacates"
        )

        let result = validateMyOrderCheckout(
            currentMember: currentMember,
            members: [currentMember],
            products: [avocados],
            seasonalCommitments: [
                seasonalCommitment(
                    productId: "legacy_code_commitment",
                    seasonKey: "AVO-2025-26",
                    fixedQtyPerOfferedWeek: 1
                )
            ],
            selectedQuantities: [:],
            selectedEcoBasketOptions: [:],
            currentWeekParity: .even
        )

        #expect(result.isValid == false)
        #expect(result.missingCommitmentProductNames == ["Aguacates"])
    }

    @Test
    func myOrderValidationBlocksExceededSeasonalCommitmentUsingSeasonCodeFallback() {
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let avocados = regularProduct(
            id: "product_common_avocado",
            vendorId: "compras_reguerta",
            name: "Aguacates"
        )

        let result = validateMyOrderCheckout(
            currentMember: currentMember,
            members: [currentMember],
            products: [avocados],
            seasonalCommitments: [
                seasonalCommitment(
                    productId: "legacy_code_commitment",
                    seasonKey: "AVO-2025-26",
                    fixedQtyPerOfferedWeek: 2
                )
            ],
            selectedQuantities: [avocados.id: 3],
            selectedEcoBasketOptions: [:],
            currentWeekParity: .even
        )

        #expect(result.isValid == false)
        #expect(result.exceededCommitmentProductNames == ["Aguacates"])
    }

    @Test
    func myOrderValidationFlagsEcoBasketPriceMismatch() {
        let currentMember = member(id: "member_1", ecoCommitmentMode: .weekly)
        let producerEven = producer(id: "producer_even", parity: .even)
        let producerOdd = producer(id: "producer_odd", parity: .odd)
        let ecoEven = ecoBasketProduct(id: "eco_even", vendorId: producerEven.id, price: 2.0)
        let ecoOdd = ecoBasketProduct(id: "eco_odd", vendorId: producerOdd.id, price: 2.5)

        let result = validateMyOrderCheckout(
            currentMember: currentMember,
            members: [currentMember, producerEven, producerOdd],
            products: [ecoEven, ecoOdd],
            selectedQuantities: [ecoEven.id: 1],
            selectedEcoBasketOptions: [ecoEven.id: ecoBasketOptionPickup]
        )

        #expect(result.hasEcoBasketPriceMismatch == true)
    }

    @Test
    func seasonalCommitmentLookupKeysIncludeMemberIdAuthUIDAndEmail() {
        let member = Member(
            id: "member_1",
            displayName: "Member",
            normalizedEmail: "member_1@reguerta.app",
            authUid: "uid_member_1",
            roles: [.member],
            isActive: true,
            producerCatalogEnabled: true
        )

        #expect(member.seasonalCommitmentLookupKeys == ["member_1", "uid_member_1", "member_1@reguerta.app"])
    }

    @Test
    func seasonalCommitmentLookupKeysRemoveDuplicatesAndBlanks() {
        let member = Member(
            id: "member_1",
            displayName: "Member",
            normalizedEmail: "   ",
            authUid: " member_1 ",
            roles: [.member],
            isActive: true,
            producerCatalogEnabled: true
        )

        #expect(member.seasonalCommitmentLookupKeys == ["member_1"])
    }
}
