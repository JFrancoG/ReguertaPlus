import Foundation

enum ProducerOrderStatus: String, CaseIterable, Equatable, Sendable {
    case unread
    case read
    case prepared
    case delivered

    static func from(_ rawValue: String?) -> ProducerOrderStatus {
        guard let rawValue else { return .unread }
        return ProducerOrderStatus(rawValue: rawValue.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()) ?? .unread
    }

    var title: String {
        switch self {
        case .unread: return "Pendiente"
        case .read: return "Pendiente"
        case .prepared: return "Preparado"
        case .delivered: return "Entregado"
        }
    }
}

struct ReceivedOrderLineRecord: Identifiable, Equatable, Sendable {
    let id: String
    let orderId: String
    let consumerId: String
    let consumerDisplayName: String
    let productId: String
    let productName: String
    let productImageUrl: String?
    let companyName: String
    let packagingLine: String
    let quantity: Double
    let quantityUnitSingular: String
    let quantityUnitPlural: String
    let measureQuantityPerUnit: Double
    let measureUnitSingular: String
    let measureUnitPlural: String
    let measureUnitAbbreviation: String?
    let isWeightPricing: Bool
    let subtotal: Double

    var dedupKey: String {
        "\(orderId)|\(consumerId)|\(productId)"
    }

    var totalMeasureQuantity: Double {
        guard isWeightPricing else {
            return quantity * measureQuantityPerUnit
        }
        return weightQuantityRepresentsMeasure ? quantity : quantity * measureQuantityPerUnit
    }

    var orderedQuantity: Double {
        guard isWeightPricing, measureQuantityPerUnit > 0 else {
            return quantity
        }
        return weightQuantityRepresentsMeasure ? quantity / measureQuantityPerUnit : quantity
    }

    private var weightQuantityRepresentsMeasure: Bool {
        guard isWeightPricing, measureQuantityPerUnit > 0 else {
            return true
        }
        return quantity >= measureQuantityPerUnit
    }
}

struct ReceivedOrdersProductRow: Identifiable, Equatable, Sendable {
    let productId: String
    let productName: String
    let productImageUrl: String?
    let companyName: String
    let packagingLine: String
    let totalQuantity: Double
    let quantityUnitSingular: String
    let quantityUnitPlural: String
    let totalMeasureQuantity: Double
    let measureUnitSingular: String
    let measureUnitPlural: String
    let measureUnitAbbreviation: String?
    let subtotal: Double

    var id: String { productId }

    func quantityUnitLabel() -> String {
        receivedOrdersIsApproximatelyOne(totalQuantity) ? quantityUnitSingular : quantityUnitPlural
    }

    func totalMeasureLabel() -> String {
        receivedOrdersMeasureLabel(
            quantity: totalMeasureQuantity,
            singular: measureUnitSingular,
            plural: measureUnitPlural,
            abbreviation: measureUnitAbbreviation,
            prefersAbbreviation: true
        )
    }
}

struct ReceivedOrdersMemberLine: Identifiable, Equatable, Sendable {
    let id: String
    let productName: String
    let packagingLine: String
    let quantity: Double
    let quantityUnitSingular: String
    let quantityUnitPlural: String
    let totalMeasureQuantity: Double
    let measureUnitSingular: String
    let measureUnitPlural: String
    let measureUnitAbbreviation: String?
    let subtotal: Double

    func quantityUnitLabel() -> String {
        receivedOrdersIsApproximatelyOne(quantity) ? quantityUnitSingular : quantityUnitPlural
    }

    func totalMeasureLabel() -> String {
        receivedOrdersMeasureLabel(
            quantity: totalMeasureQuantity,
            singular: measureUnitSingular,
            plural: measureUnitPlural,
            abbreviation: measureUnitAbbreviation,
            prefersAbbreviation: true
        )
    }
}

struct ReceivedOrdersMemberGroup: Identifiable, Equatable, Sendable {
    let id: String
    let orderId: String
    let consumerDisplayName: String
    let producerStatus: ProducerOrderStatus
    let lines: [ReceivedOrdersMemberLine]
    let total: Double
}

struct ReceivedOrdersSnapshot: Equatable, Sendable {
    let byProductRows: [ReceivedOrdersProductRow]
    let byMemberGroups: [ReceivedOrdersMemberGroup]
    let generalTotal: Double
}

func receivedOrdersIsApproximatelyOne(_ value: Double) -> Bool {
    abs(value - 1) < 0.000_1
}

func receivedOrdersMeasureLabel(
    quantity: Double,
    singular: String,
    plural: String,
    abbreviation: String?,
    prefersAbbreviation: Bool
) -> String {
    let quantityText = quantity.myOrderUiDecimal
    let numberAwareUnit = receivedOrdersIsApproximatelyOne(quantity) ? singular : plural
    let unit = prefersAbbreviation
        ? (abbreviation?.isNotEmpty == true ? abbreviation! : numberAwareUnit)
        : numberAwareUnit
    return [quantityText, unit]
        .filter(\.isNotEmpty)
        .joined(separator: " ")
}

extension ReceivedOrdersSnapshot {
    func withProducerStatus(orderId: String, status: ProducerOrderStatus) -> ReceivedOrdersSnapshot {
        ReceivedOrdersSnapshot(
            byProductRows: byProductRows,
            byMemberGroups: byMemberGroups.map { group in
                if group.orderId == orderId {
                    return ReceivedOrdersMemberGroup(
                        id: group.id,
                        orderId: group.orderId,
                        consumerDisplayName: group.consumerDisplayName,
                        producerStatus: status,
                        lines: group.lines,
                        total: group.total
                    )
                }
                return group
            },
            generalTotal: generalTotal
        )
    }
}
