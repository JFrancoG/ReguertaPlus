import Foundation
import Testing

@testable import Reguerta

@MainActor
struct FirestoreNumericScalarDecodingTests {
    @Test func productAcceptsFirestoreIntegerNumbers() throws {
        var data = validProductData()
        data["price"] = NSNumber(value: 1)
        data["unitQty"] = NSNumber(value: 1)
        data["stockQty"] = NSNumber(value: 0)

        let product = try FirestoreProductRepository.product(documentID: "product", data: data)

        #expect(product.price == 1)
        #expect(product.unitQty == 1)
        #expect(product.stockQty == 0)
    }

    @Test func productDistinguishesFirestoreBooleansFromIntegerNumbers() {
        var booleanQuantity = validProductData()
        booleanQuantity["unitQty"] = NSNumber(value: true)
        #expect(throws: RepositoryError.invalidData(resource: "products.document")) {
            try FirestoreProductRepository.product(documentID: "product", data: booleanQuantity)
        }

        var numericArchived = validProductData()
        numericArchived["archived"] = NSNumber(value: 0)
        #expect(throws: RepositoryError.invalidData(resource: "products.document")) {
            try FirestoreProductRepository.product(documentID: "product", data: numericArchived)
        }
    }

    @Test func commitmentAcceptsFirestoreIntegerQuantityAndBooleanFlag() throws {
        let commitment = try FirestoreSeasonalCommitmentRepository.commitment(
            documentID: "commitment",
            data: [
                "userId": "member",
                "productId": "product",
                "seasonKey": "2026",
                "fixedQty": NSNumber(value: 1),
                "active": NSNumber(value: true)
            ]
        )

        #expect(commitment.fixedQtyPerOfferedWeek == 1)
        #expect(commitment.active)
    }

    private func validProductData() -> [String: Any] {
        [
            "vendorId": "producer",
            "companyName": "Productor",
            "name": "Tomates",
            "price": 2.0,
            "pricingMode": "fixed",
            "unitName": "unidad",
            "unitPlural": "unidades",
            "unitQty": 1.0,
            "isAvailable": true,
            "stockMode": "infinite",
            "archived": false
        ]
    }
}
