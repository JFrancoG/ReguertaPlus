import CoreFoundation
import Foundation

/// Maps a Firestore-compatible order-line payload into the immutable value consumed by Orders.
///
/// Legacy numeric strings and fallback document identities remain supported. Boolean and non-finite scalars,
/// non-positive quantities, and negative prices or totals are rejected; invalid per-unit measures normalize to one so a
/// valid order line remains displayable without contaminating aggregate quantities.
func receivedOrderLineRecord(from data: [String: Any], fallbackDocumentID: String) -> ReceivedOrderLineRecord? {
    let orderId = receivedOrderString(from: data["orderId"]) ?? fallbackDocumentID
    let consumerId = receivedOrderString(from: data["userId"]) ?? "__consumer_unknown__"
    let consumerDisplayName = receivedOrderString(from: data["consumerDisplayName"]) ?? consumerId
    let productId = receivedOrderString(from: data["productId"]) ?? fallbackDocumentID
    let productName = receivedOrderString(from: data["productName"]) ?? "Producto"
    let companyName = receivedOrderString(from: data["companyName"]) ?? "Productor"
    let productImageUrl = receivedOrderString(from: data["productImageUrl"])
    guard let quantity = receivedOrderDouble(from: data["quantity"]), quantity > 0 else { return nil }
    let priceAtOrder = receivedOrderDouble(from: data["priceAtOrder"])
    guard data["priceAtOrder"] == nil || (priceAtOrder ?? -1) >= 0 else { return nil }
    let explicitSubtotal = receivedOrderDouble(from: data["subtotal"])
    guard data["subtotal"] == nil || explicitSubtotal != nil else { return nil }
    let subtotal = explicitSubtotal ?? quantity * (priceAtOrder ?? 0)
    guard subtotal.isFinite, subtotal >= 0 else { return nil }
    let quantityUnitSingular = receivedOrderString(from: data["packContainerName"])
        ?? receivedOrderString(from: data["unitName"])
        ?? "ud."
    let quantityUnitPlural = receivedOrderString(from: data["packContainerPlural"])
        ?? receivedOrderString(from: data["unitPlural"])
        ?? quantityUnitSingular
    let measureQuantityPerUnit = receivedOrderMeasureQuantityPerUnit(from: data)
    let measureUnitSingular = receivedOrderString(from: data["unitName"])
        ?? quantityUnitSingular
    let measureUnitPlural = receivedOrderString(from: data["unitPlural"])
        ?? measureUnitSingular
    let measureUnitAbbreviation = receivedOrderString(from: data["unitAbbreviation"])
        ?? receivedOrderString(from: data["packContainerAbbreviation"])
    let pricingMode = receivedOrderString(from: data["pricingModeAtOrder"])?.lowercased()

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
        measureQuantityPerUnit: measureQuantityPerUnit,
        measureUnitSingular: measureUnitSingular,
        measureUnitPlural: measureUnitPlural,
        measureUnitAbbreviation: measureUnitAbbreviation,
        isWeightPricing: pricingMode == ProductPricingMode.weight.rawValue,
        subtotal: subtotal
    )
}

private func receivedOrderPackagingLine(from data: [String: Any]) -> String {
    let containerName = receivedOrderString(from: data["packContainerName"])
        ?? receivedOrderString(from: data["unitName"])
        ?? ""
    let quantity = receivedOrderMeasureQuantityPerUnit(from: data)
    let unitName = receivedOrderString(from: data["unitName"]) ?? ""
    let unitPlural = receivedOrderString(from: data["unitPlural"]) ?? unitName
    let unitLabel = receivedOrdersMeasureLabel(
        quantity: quantity,
        singular: unitName,
        plural: unitPlural,
        abbreviation: receivedOrderString(from: data["unitAbbreviation"])
            ?? receivedOrderString(from: data["packContainerAbbreviation"]),
        prefersAbbreviation: false
    )

    return [containerName, unitLabel]
        .filter(\.isNotEmpty)
        .joined(separator: " ")
}

private func receivedOrderMeasureQuantityPerUnit(from data: [String: Any]) -> Double {
    let quantity = receivedOrderDouble(from: data["unitQty"])
        ?? receivedOrderDouble(from: data["packContainerQty"])
        ?? 1
    return quantity > 0 ? quantity : 1
}

private func receivedOrderString(from value: Any?) -> String? {
    guard let raw = value as? String else { return nil }
    let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
}

private func receivedOrderDouble(from value: Any?) -> Double? {
    if let number = value as? NSNumber {
        guard CFGetTypeID(number) != CFBooleanGetTypeID() else { return nil }
        let parsed = number.doubleValue
        return parsed.isFinite ? parsed : nil
    }
    if let raw = value as? String {
        guard let parsed = Double(raw.replacingOccurrences(of: ",", with: ".")), parsed.isFinite else { return nil }
        return parsed
    }
    return nil
}
