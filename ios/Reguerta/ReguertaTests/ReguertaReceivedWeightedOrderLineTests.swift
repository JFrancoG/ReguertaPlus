import Testing

@testable import Reguerta

@MainActor
@Test
func receivedOrdersProductRowsDisplayOrderedUnitsForWeightedLines() {
    let line = receivedWeightedOrderLine(
        quantity: 200,
        subtotal: 4,
        priceAtOrder: 0.02,
        documentId: "order_weight_almond"
    )

    #expect(line?.orderedQuantity == 2)
    #expect(line?.totalMeasureQuantity == 200)
    #expect(line?.packagingLine == "A granel 100 gramos aprox.")

    let unitsStoredLine = receivedWeightedOrderLine(
        quantity: 2,
        subtotal: 4,
        priceAtOrder: 0.02,
        documentId: "order_weight_units_almond"
    )

    #expect(unitsStoredLine?.orderedQuantity == 2)
    #expect(unitsStoredLine?.totalMeasureQuantity == 200)

    let packPricedLine = receivedWeightedOrderLine(
        productId: "pistachio",
        productName: "Pistacho tostado y salado",
        quantity: 2,
        subtotal: 5.93,
        priceAtOrder: 2.965,
        unitName: "gramos",
        unitAbbreviation: "g",
        documentId: "order_weight_pack_price_pistachio"
    )

    #expect(packPricedLine?.orderedQuantity == 2)
    #expect(packPricedLine?.totalMeasureQuantity == 200)
}

private func receivedWeightedOrderLine(
    productId: String = "almond",
    productName: String = "Almendra",
    quantity: Double,
    subtotal: Double,
    priceAtOrder: Double,
    unitName: String = "gramos aprox.",
    unitAbbreviation: String = "g aprox.",
    documentId: String
) -> ReceivedOrderLineRecord? {
    receivedOrderLineRecord(
        from: [
            "orderId": documentId,
            "userId": "member_1",
            "consumerDisplayName": "Carmen",
            "productId": productId,
            "productName": productName,
            "quantity": quantity,
            "subtotal": subtotal,
            "priceAtOrder": priceAtOrder,
            "pricingModeAtOrder": "weight",
            "packContainerName": "A granel",
            "packContainerQty": 1,
            "unitQty": 100,
            "unitName": unitName,
            "unitAbbreviation": unitAbbreviation
        ],
        fallbackDocumentID: documentId
    )
}
