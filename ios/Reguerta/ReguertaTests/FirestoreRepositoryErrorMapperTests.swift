import FirebaseFirestore
import Foundation
import Testing

@testable import Reguerta

@MainActor
struct FirestoreRepositoryErrorMapperTests {
    @Test
    func mapsFirestoreFailuresToDomainErrors() {
        let resource = "products"

        #expect(
            mappedError(code: FirestoreErrorCode.permissionDenied.rawValue, resource: resource) ==
                .permissionDenied(resource: resource)
        )
        #expect(
            mappedError(code: FirestoreErrorCode.unavailable.rawValue, resource: resource) ==
                .unavailable(resource: resource)
        )
        #expect(
            mappedError(code: FirestoreErrorCode.dataLoss.rawValue, resource: resource) ==
                .invalidData(resource: resource)
        )
    }

    @Test
    func preservesCancellationWithoutDomainMapping() {
        let mapped = FirestoreRepositoryErrorMapper.map(
            CancellationError(),
            resource: "products"
        )

        #expect(mapped is CancellationError)
    }

    @Test
    func rejectsMalformedProductAndCommitmentDocumentsAsInvalidData() throws {
        var invalidProduct = validProductData()
        invalidProduct["pricingMode"] = "mystery"
        #expect(throws: RepositoryError.invalidData(resource: "products.document")) {
            try FirestoreProductRepository.product(documentID: "product", data: invalidProduct)
        }

        invalidProduct = validProductData()
        invalidProduct["archived"] = "false"
        #expect(throws: RepositoryError.invalidData(resource: "products.document")) {
            try FirestoreProductRepository.product(documentID: "product", data: invalidProduct)
        }

        invalidProduct = validProductData()
        invalidProduct["price"] = Double.infinity
        #expect(throws: RepositoryError.invalidData(resource: "products.document")) {
            try FirestoreProductRepository.product(documentID: "product", data: invalidProduct)
        }

        invalidProduct = validProductData()
        invalidProduct["pricingMode"] = "weight"
        invalidProduct["weightStep"] = 1.0
        invalidProduct["minWeight"] = 1.0
        invalidProduct["maxWeight"] = 1e300
        #expect(throws: RepositoryError.invalidData(resource: "products.document")) {
            try FirestoreProductRepository.product(documentID: "product", data: invalidProduct)
        }

        invalidProduct = validProductData()
        invalidProduct["pricingMode"] = "   "
        #expect(throws: RepositoryError.invalidData(resource: "products.document")) {
            try FirestoreProductRepository.product(documentID: "product", data: invalidProduct)
        }

        let invalidCommitment: [String: Any] = [
            "userId": "member",
            "productId": "product",
            "seasonKey": "2026",
            "fixedQty": 1.0,
            "active": "true"
        ]
        #expect(throws: RepositoryError.invalidData(resource: "seasonalCommitments.document")) {
            try FirestoreSeasonalCommitmentRepository.commitment(
                documentID: "commitment",
                data: invalidCommitment
            )
        }


        var infiniteQuantity = invalidCommitment
        infiniteQuantity["active"] = true
        infiniteQuantity["fixedQty"] = Double.infinity
        #expect(throws: RepositoryError.invalidData(resource: "seasonalCommitments.document")) {
            try FirestoreSeasonalCommitmentRepository.commitment(
                documentID: "commitment",
                data: infiniteQuantity
            )
        }

        var booleanQuantity = invalidCommitment
        booleanQuantity["active"] = true
        booleanQuantity["fixedQty"] = true
        #expect(throws: RepositoryError.invalidData(resource: "seasonalCommitments.document")) {
            try FirestoreSeasonalCommitmentRepository.commitment(
                documentID: "commitment",
                data: booleanQuantity
            )
        }

        var legacyNullProduct = validProductData()
        legacyNullProduct["productImageUrl"] = NSNull()
        #expect(try FirestoreProductRepository.product(
            documentID: "product",
            data: legacyNullProduct
        ).productImageUrl == nil)
    }

    @Test
    func productMergePayloadDeletesClearedOptionalFields() throws {
        let product = try FirestoreProductRepository.product(
            documentID: "product",
            data: validProductData()
        )
        let payload = FirestoreProductRepository.upsertPayload(for: product)

        #expect(payload["productImageUrl"] is FieldValue)
        #expect(payload["packContainerName"] is FieldValue)
        #expect(payload["stockQty"] is FieldValue)
        #expect(payload["weightStep"] is FieldValue)
        #expect(payload["commonPurchaseType"] is FieldValue)
    }

    private func mappedError(code: Int, resource: String) -> RepositoryError? {
        let error = NSError(
            domain: FirestoreErrorDomain,
            code: code
        )
        return FirestoreRepositoryErrorMapper.map(error, resource: resource) as? RepositoryError
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
