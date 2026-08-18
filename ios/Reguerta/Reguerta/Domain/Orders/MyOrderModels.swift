import Foundation

let myOrderCommonPurchasesGroupId = "__my_order_reguerta_common_purchases__"

struct MyOrderCartSnapshot: Equatable {
    let selectedQuantities: [String: Int]
    let selectedEcoBasketOptions: [String: String]

    nonisolated static let empty = MyOrderCartSnapshot(selectedQuantities: [:], selectedEcoBasketOptions: [:])

    nonisolated var normalized: MyOrderCartSnapshot {
        let normalizedQuantities = selectedQuantities.filter { $0.value > 0 }
        let normalizedOptions = selectedEcoBasketOptions
            .filter { normalizedQuantities[$0.key, default: 0] > 0 }
            .filter { $0.value == ecoBasketOptionPickup || $0.value == ecoBasketOptionNoPickup }
        return MyOrderCartSnapshot(
            selectedQuantities: normalizedQuantities,
            selectedEcoBasketOptions: normalizedOptions
        )
    }
}

struct MyOrderConfirmedLine: Identifiable, Equatable {
    let product: Product
    let unitsSelected: Int
    let quantityAtOrder: Double
    let subtotal: Double

    var id: String { product.id }
}

struct MyOrderConfirmedGroup: Identifiable, Equatable {
    let vendorId: String
    let companyName: String
    let producerStatus: ProducerOrderStatus
    let lines: [MyOrderConfirmedLine]
    let subtotal: Double

    var id: String { vendorId }
}

struct MyOrderProducerStatusSnapshot: Equatable {
    let byVendor: [String: ProducerOrderStatus]
    let legacyStatus: ProducerOrderStatus
}

struct MyOrderPreviousOrderLine: Identifiable, Equatable {
    let vendorId: String
    let companyName: String
    let productName: String
    let packagingLine: String
    let quantityLabel: String
    let subtotal: Double

    var id: String { "\(vendorId)_\(productName)" }
}

struct MyOrderPreviousOrderGroup: Identifiable, Equatable {
    let vendorId: String
    let companyName: String
    let lines: [MyOrderPreviousOrderLine]
    let subtotal: Double

    var id: String { vendorId }
}

struct MyOrderPreviousGroupKey: Hashable {
    let vendorId: String
    let companyName: String
}

struct MyOrderPreviousOrderSnapshot: Equatable {
    let weekKey: String
    let groups: [MyOrderPreviousOrderGroup]
    let total: Double
}

struct MyOrderConsultaWindow: Equatable {
    let isConsultaPhase: Bool
    let previousWeekKey: String
}
