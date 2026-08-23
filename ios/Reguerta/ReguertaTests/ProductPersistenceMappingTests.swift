import Testing

@testable import Reguerta

@Suite("Product persistence mapping")
struct ProductPersistenceMappingTests {
    @Test func assigningDocumentIDPreservesWeightConfigurationAndPayload() {
        let source = weightedProduct()

        let persisted = FirestoreProductRepository.productForPersistence(
            source,
            documentID: "generated-product"
        )

        #expect(persisted.id == "generated-product")
        #expect(persisted.weightStep == 0.5)
        #expect(persisted.minWeight == 1)
        #expect(persisted.maxWeight == 3)

        let payload = FirestoreProductRepository.upsertPayload(for: persisted)
        #expect(payload["weightStep"] as? Double == 0.5)
        #expect(payload["minWeight"] as? Double == 1)
        #expect(payload["maxWeight"] as? Double == 3)
    }

    private func weightedProduct() -> Product {
        Product(
            id: "",
            vendorId: "producer",
            companyName: "Producer",
            name: "Patatas",
            description: "",
            productImageUrl: nil,
            price: 2,
            pricingMode: .weight,
            unitName: "kilo",
            unitAbbreviation: "kg",
            unitPlural: "kilos",
            unitQty: 0.5,
            packContainerName: "A granel",
            packContainerAbbreviation: "A granel",
            packContainerPlural: "A granel",
            packContainerQty: nil,
            isAvailable: true,
            stockMode: .infinite,
            stockQty: nil,
            isEcoBasket: false,
            isCommonPurchase: false,
            commonPurchaseType: nil,
            archived: false,
            createdAtMillis: 1,
            updatedAtMillis: 1,
            weightStep: 0.5,
            minWeight: 1,
            maxWeight: 3
        )
    }
}
