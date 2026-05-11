import SwiftUI

extension ProducerOrderStatus {
    var visualStyle: ProducerStatusVisualStyle {
        switch self {
        case .unread:
            return ProducerStatusVisualStyle(
                container: Color(.systemGray6).opacity(0.82),
                border: Color(.systemGray4)
            )
        case .read:
            return ProducerStatusVisualStyle(
                container: Color(.systemGray6).opacity(0.82),
                border: Color(.systemGray4)
            )
        case .prepared:
            return ProducerStatusVisualStyle(
                container: Color(red: 1.0, green: 0.95, blue: 0.84),
                border: Color(red: 0.84, green: 0.66, blue: 0.31)
            )
        case .delivered:
            return ProducerStatusVisualStyle(
                container: Color(red: 0.90, green: 0.97, blue: 0.90),
                border: Color(red: 0.46, green: 0.64, blue: 0.44)
            )
        }
    }
}

func receivedOrderLineRecord(
    from data: [String: Any],
    fallbackDocumentID: String
) -> ReceivedOrderLineRecord? {
    let orderId = receivedOrderString(from: data["orderId"]) ?? fallbackDocumentID
    let consumerId = receivedOrderString(from: data["userId"]) ?? "__consumer_unknown__"
    let consumerDisplayName = receivedOrderString(from: data["consumerDisplayName"]) ?? consumerId
    let productId = receivedOrderString(from: data["productId"]) ?? fallbackDocumentID
    let productName = receivedOrderString(from: data["productName"]) ?? "Producto"
    let companyName = receivedOrderString(from: data["companyName"]) ?? "Productor"
    let productImageUrl = receivedOrderString(from: data["productImageUrl"])
    let quantity = receivedOrderDouble(from: data["quantity"]) ?? 0
    guard quantity > 0 else { return nil }
    let subtotal = receivedOrderDouble(from: data["subtotal"])
        ?? quantity * (receivedOrderDouble(from: data["priceAtOrder"]) ?? 0)
    let quantityUnitSingular = receivedOrderString(from: data["packContainerName"])
        ?? receivedOrderString(from: data["unitName"])
        ?? "ud."
    let quantityUnitPlural = receivedOrderString(from: data["packContainerPlural"])
        ?? receivedOrderString(from: data["unitPlural"])
        ?? quantityUnitSingular

    return ReceivedOrderLineRecord(
        id: "\(orderId)_\(productId)_\(consumerId)",
        orderId: orderId,
        consumerId: consumerId,
        consumerDisplayName: consumerDisplayName,
        productId: productId,
        productName: productName,
        productImageUrl: productImageUrl,
        companyName: companyName,
        packagingLine: receivedOrderPackagingLine(from: data),
        quantity: quantity,
        quantityUnitSingular: quantityUnitSingular,
        quantityUnitPlural: quantityUnitPlural,
        subtotal: subtotal
    )
}

private func receivedOrderPackagingLine(from data: [String: Any]) -> String {
    let containerName = receivedOrderString(from: data["packContainerName"])
        ?? receivedOrderString(from: data["unitName"])
        ?? ""
    let quantity = (receivedOrderDouble(from: data["packContainerQty"])
        ?? receivedOrderDouble(from: data["unitQty"])
        ?? 1).myOrderUiDecimal
    let unitLabel = receivedOrderString(from: data["packContainerAbbreviation"])
        ?? receivedOrderString(from: data["packContainerPlural"])
        ?? receivedOrderString(from: data["unitAbbreviation"])
        ?? receivedOrderString(from: data["unitPlural"])
        ?? receivedOrderString(from: data["unitName"])
        ?? ""

    return [containerName, quantity, unitLabel]
        .filter(\.isNotEmpty)
        .joined(separator: " ")
}

private func receivedOrderString(from value: Any?) -> String? {
    guard let raw = value as? String else { return nil }
    let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
}

private func receivedOrderDouble(from value: Any?) -> Double? {
    if let number = value as? NSNumber {
        return number.doubleValue
    }
    if let raw = value as? String {
        return Double(raw.replacingOccurrences(of: ",", with: "."))
    }
    return nil
}

func receivedOrdersIsApproximatelyOne(_ value: Double) -> Bool {
    abs(value - 1) < 0.000_1
}
