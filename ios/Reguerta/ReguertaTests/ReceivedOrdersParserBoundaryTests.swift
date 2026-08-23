import Foundation
import Testing

@testable import Reguerta

@Suite("Received Orders parser boundary")
struct ReceivedOrdersParserBoundaryTests {
    @Test func parserIsOwnedByDataAndAbsentFromPresentation() throws {
        let declaration = "func receivedOrderLineRecord("
        let dataSource = try combinedSwiftSource(in: productionSourceRoot.appending(path: "Data/Orders"))
        let presentationDirectory = productionSourceRoot.appending(path: "Presentation/Orders")
        let presentationSource = try combinedSwiftSource(in: presentationDirectory)

        #expect(dataSource.occurrenceCount(of: declaration) == 1)
        #expect(presentationSource.occurrenceCount(of: declaration) == 0)
    }

    @Test func parserPreservesFirestoreNormalizationAndFallbacks() throws {
        let record = try #require(receivedOrderLineRecord(
            from: [
                "orderId": " order_1 ",
                "userId": " member_1 ",
                "consumerDisplayName": "  ",
                "productId": "",
                "productName": " ",
                "productImageUrl": " https://example.com/product.png ",
                "quantity": "2,5",
                "priceAtOrder": NSNumber(value: 4),
                "packContainerName": "Caja",
                "unitQty": "2",
                "unitName": "kilo",
                "unitPlural": "kilos",
                "unitAbbreviation": "kg",
                "pricingModeAtOrder": " WEIGHT "
            ],
            fallbackDocumentID: "fallback_doc"
        ))

        #expect(record.id == "order_1_fallback_doc_member_1")
        #expect(record.orderId == "order_1")
        #expect(record.consumerId == "member_1")
        #expect(record.consumerDisplayName == "member_1")
        #expect(record.productId == "fallback_doc")
        #expect(record.productName == "Producto")
        #expect(record.productImageUrl == "https://example.com/product.png")
        #expect(record.companyName == "Productor")
        #expect(record.packagingLine == "Caja 2 kilos")
        #expect(record.quantity == 2.5)
        #expect(record.quantityUnitSingular == "Caja")
        #expect(record.quantityUnitPlural == "kilos")
        #expect(record.measureQuantityPerUnit == 2)
        #expect(record.measureUnitSingular == "kilo")
        #expect(record.measureUnitPlural == "kilos")
        #expect(record.measureUnitAbbreviation == "kg")
        #expect(record.isWeightPricing)
        #expect(record.subtotal == 10)
    }

    @Test func parserRejectsMissingAndNonPositiveQuantities() {
        let missingQuantity = receivedOrderLineRecord(from: [:], fallbackDocumentID: "missing")
        let zeroQuantity = receivedOrderLineRecord(from: ["quantity": 0], fallbackDocumentID: "zero")
        let negativeQuantity = receivedOrderLineRecord(from: ["quantity": -1], fallbackDocumentID: "negative")

        #expect(missingQuantity == nil)
        #expect(zeroQuantity == nil)
        #expect(negativeQuantity == nil)
    }

    @Test func parserRejectsBooleanNonFiniteAndNegativeMonetaryScalars() {
        let booleanQuantity = receivedOrderLineRecord(
            from: ["quantity": NSNumber(value: true)],
            fallbackDocumentID: "boolean"
        )
        let infiniteQuantity = receivedOrderLineRecord(
            from: ["quantity": Double.infinity],
            fallbackDocumentID: "infinite_quantity"
        )
        let infiniteSubtotal = receivedOrderLineRecord(
            from: ["quantity": 1, "subtotal": Double.infinity],
            fallbackDocumentID: "infinite_subtotal"
        )
        let booleanPrice = receivedOrderLineRecord(
            from: ["quantity": 1, "priceAtOrder": NSNumber(value: true)],
            fallbackDocumentID: "boolean_price"
        )
        let infinitePrice = receivedOrderLineRecord(
            from: ["quantity": 1, "priceAtOrder": Double.infinity],
            fallbackDocumentID: "infinite_price"
        )
        let negativeSubtotal = receivedOrderLineRecord(
            from: ["quantity": 1, "subtotal": -1],
            fallbackDocumentID: "negative_subtotal"
        )

        #expect(booleanQuantity == nil)
        #expect(infiniteQuantity == nil)
        #expect(infiniteSubtotal == nil)
        #expect(booleanPrice == nil)
        #expect(infinitePrice == nil)
        #expect(negativeSubtotal == nil)
    }

    @Test func parserRejectsNegativePriceEvenWhenExplicitSubtotalIsPositive() {
        let record = receivedOrderLineRecord(
            from: ["quantity": 1, "priceAtOrder": -1, "subtotal": 1],
            fallbackDocumentID: "negative_price"
        )

        #expect(record == nil)
    }

    @Test func parserNormalizesInvalidMeasureQuantityToOne() throws {
        let zeroMeasure = try #require(receivedOrderLineRecord(
            from: ["quantity": 1, "unitQty": 0],
            fallbackDocumentID: "zero_measure"
        ))
        let infiniteMeasure = try #require(receivedOrderLineRecord(
            from: ["quantity": 1, "unitQty": Double.infinity],
            fallbackDocumentID: "infinite_measure"
        ))

        #expect(zeroMeasure.measureQuantityPerUnit == 1)
        #expect(infiniteMeasure.measureQuantityPerUnit == 1)
    }

    private var productionSourceRoot: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appending(path: "Reguerta")
    }

    private func combinedSwiftSource(in directory: URL) throws -> String {
        try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
            .filter { $0.pathExtension == "swift" }
            .sorted { $0.path < $1.path }
            .map { try String(contentsOf: $0, encoding: .utf8) }
            .joined(separator: "\n")
    }
}

private extension String {
    func occurrenceCount(of value: String) -> Int {
        components(separatedBy: value).count - 1
    }
}
