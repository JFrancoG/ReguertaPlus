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
    let subtotal: Double

    var dedupKey: String {
        "\(orderId)|\(consumerId)|\(productId)"
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

    var id: String { productId }

    func quantityUnitLabel() -> String {
        receivedOrdersIsApproximatelyOne(totalQuantity) ? quantityUnitSingular : quantityUnitPlural
    }
}

struct ReceivedOrdersMemberLine: Identifiable, Equatable, Sendable {
    let id: String
    let productName: String
    let packagingLine: String
    let quantity: Double
    let quantityUnitSingular: String
    let quantityUnitPlural: String
    let subtotal: Double

    func quantityUnitLabel() -> String {
        receivedOrdersIsApproximatelyOne(quantity) ? quantityUnitSingular : quantityUnitPlural
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
