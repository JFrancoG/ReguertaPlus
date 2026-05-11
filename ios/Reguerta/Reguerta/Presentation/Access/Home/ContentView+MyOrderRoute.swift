import SwiftUI

let myOrderCommonPurchasesGroupId = "__my_order_reguerta_common_purchases__"
let myOrderCartStoragePrefix = "reguerta_my_order_cart"
let myOrderCartQuantitiesSuffix = ".quantities"
let myOrderCartOptionsSuffix = ".eco_options"
let myOrderConfirmedQuantitiesSuffix = ".confirmed_quantities"
let myOrderConfirmedOptionsSuffix = ".confirmed_eco_options"

struct MyOrderProducerGroup: Identifiable {
    let vendorId: String
    let companyName: String
    let products: [Product]
    let hasCommonPurchase: Bool
    let isCommittedEcoBasketProducer: Bool
    let isCommonPurchasesGroup: Bool

    var id: String { vendorId }

    var sortPriority: Int {
        if isCommittedEcoBasketProducer { return 0 }
        if isCommonPurchasesGroup { return 1 }
        if hasCommonPurchase { return 2 }
        return 3
    }
}

enum MyOrderCheckoutAlert: Identifiable {
    case missingCommitments([String])
    case exceededCommitments([String])
    case incompatibleCommitments([String])
    case ecoBasketPriceMismatch
    case submitFailed
    case readyToSubmit(total: Double, noPickupEcoBaskets: Int)

    var id: String {
        switch self {
        case .missingCommitments(let names):
            return "missing:\(names.joined(separator: ","))"
        case .exceededCommitments(let names):
            return "exceeded:\(names.joined(separator: ","))"
        case .incompatibleCommitments(let names):
            return "incompatible:\(names.joined(separator: ","))"
        case .ecoBasketPriceMismatch:
            return "ecoBasketPriceMismatch"
        case .submitFailed:
            return "submitFailed"
        case .readyToSubmit(let total, let noPickupEcoBaskets):
            return "ready:\(total):\(noPickupEcoBaskets)"
        }
    }
}

struct MyOrderCartSnapshot {
    let selectedQuantities: [String: Int]
    let selectedEcoBasketOptions: [String: String]
}

struct MyOrderConfirmedLine: Identifiable {
    let product: Product
    let unitsSelected: Int
    let quantityAtOrder: Double
    let subtotal: Double

    var id: String { product.id }
}

struct MyOrderConfirmedGroup: Identifiable {
    let vendorId: String
    let companyName: String
    let producerStatus: ProducerOrderStatus
    let lines: [MyOrderConfirmedLine]
    let subtotal: Double

    var id: String { vendorId }
}

struct MyOrderProducerStatusSnapshot {
    let byVendor: [String: ProducerOrderStatus]
    let legacyStatus: ProducerOrderStatus
}

struct MyOrderPreviousOrderLine: Identifiable {
    let vendorId: String
    let companyName: String
    let productName: String
    let packagingLine: String
    let quantityLabel: String
    let subtotal: Double

    var id: String { "\(vendorId)_\(productName)" }
}

struct MyOrderPreviousOrderGroup: Identifiable {
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

struct MyOrderPreviousOrderSnapshot {
    let weekKey: String
    let groups: [MyOrderPreviousOrderGroup]
    let total: Double
}

enum MyOrderPreviousOrderState {
    case loading
    case loaded(MyOrderPreviousOrderSnapshot)
    case empty
    case error
}

struct MyOrderConsultaWindow {
    let isConsultaPhase: Bool
    let previousWeekKey: String
}

struct MyOrderRouteView: View {
    let tokens: ReguertaDesignTokens
    let products: [Product]
    let seasonalCommitments: [SeasonalCommitment]
    let shifts: [ShiftAssignment]
    let defaultDeliveryDayOfWeek: DeliveryWeekday?
    let deliveryCalendarOverrides: [DeliveryCalendarOverride]
    let nowMillis: Int64
    let isLoading: Bool
    let currentMember: Member?
    let members: [Member]
    let cartOpenRequests: Int
    let onRefresh: () -> Void
    let onCartUnitsChange: (Int) -> Void
    let onCheckoutSuccessAcknowledge: () -> Void

    @State var searchQuery = ""
    @State var selectedQuantities: [String: Int] = [:]
    @State var selectedEcoBasketOptions: [String: String] = [:]
    @State var confirmedQuantities: [String: Int] = [:]
    @State var confirmedEcoBasketOptions: [String: String] = [:]
    @State var isCartVisible = false
    @State var isSubmittingCheckout = false
    @State var checkoutAlert: MyOrderCheckoutAlert?
    @State var hasRestoredCartState = false
    @State var isViewingConfirmedOrder = false
    @State var previousOrderState: MyOrderPreviousOrderState = .loading
    @State var confirmedProducerStatusesByVendor: [String: ProducerOrderStatus] = [:]
    @State var confirmedLegacyProducerStatus: ProducerOrderStatus = .unread

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .bottom) {
                if isReadOnlyMode {
                    readOnlyOrderContent
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                } else {
                    VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                        headerRow
                        if isLoading {
                            loadingState
                        } else if groupedProducts.isEmpty {
                            emptyState
                        } else {
                            productsList
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                }

                if !isReadOnlyMode && !isCartVisible {
                    searchOverlay
                }

                if !isReadOnlyMode && isCartVisible {
                    Color.black.opacity(0.22)
                        .ignoresSafeArea()
                        .onTapGesture {
                            withAnimation(.easeInOut(duration: 0.22)) {
                                isCartVisible = false
                            }
                        }
                }

                if !isReadOnlyMode {
                    cartOverlay(proxy: proxy)
                }
            }
            .onChange(of: cartStorageKey, initial: true) { _, newStorageKey in
                let cartSnapshot = readMyOrderCartSnapshot(storageKey: newStorageKey)
                let confirmedSnapshot = readMyOrderConfirmedSnapshot(storageKey: newStorageKey)
                confirmedQuantities = confirmedSnapshot.selectedQuantities
                confirmedEcoBasketOptions = confirmedSnapshot.selectedEcoBasketOptions
                let initialSelectionSnapshot: MyOrderCartSnapshot = cartSnapshot.selectedQuantities.isEmpty
                    ? confirmedSnapshot
                    : cartSnapshot
                let isSelectionEqualToConfirmed = myOrderSnapshotsMatch(
                    initialSelectionSnapshot,
                    confirmedSnapshot
                )
                isViewingConfirmedOrder = !confirmedSnapshot.selectedQuantities.isEmpty && isSelectionEqualToConfirmed
                selectedQuantities = initialSelectionSnapshot.selectedQuantities
                selectedEcoBasketOptions = initialSelectionSnapshot.selectedEcoBasketOptions
                onCartUnitsChange(initialSelectionSnapshot.selectedQuantities.values.reduce(0, +))
                if initialSelectionSnapshot.selectedQuantities.isEmpty {
                    isCartVisible = false
                } else if isViewingConfirmedOrder {
                    isCartVisible = false
                }
                if confirmedSnapshot.selectedQuantities.isEmpty {
                    confirmedProducerStatusesByVendor = [:]
                    confirmedLegacyProducerStatus = .unread
                }
                hasRestoredCartState = true
            }
            .onChange(of: selectedQuantities) { _, _ in
                onCartUnitsChange(selectedUnits)
                persistCurrentCartSnapshotIfNeeded()
            }
            .onChange(of: cartOpenRequests) { _, newValue in
                guard newValue > 0, selectedUnits > 0, !isReadOnlyMode else { return }
                withAnimation(.easeInOut(duration: 0.22)) {
                    isCartVisible.toggle()
                }
            }
            .onChange(of: selectedEcoBasketOptions) { _, _ in
                persistCurrentCartSnapshotIfNeeded()
            }
            .onChange(of: products) { _, _ in
                sanitizeSelectedStateForCurrentProducts()
            }
            .onChange(of: seasonalCommitments) { _, _ in
                sanitizeSelectedStateForCurrentProducts()
            }
            .task(id: consultaTaskID) {
                guard isConsultaPhase else { return }
                await loadPreviousWeekOrderState(previousWeekKey: consultaWindow.previousWeekKey)
            }
            .task(id: "\(currentOrderId ?? "none")-\(hasConfirmedOrder)-\(isConsultaPhase)") {
                guard !isConsultaPhase, hasConfirmedOrder, let orderId = currentOrderId else {
                    confirmedProducerStatusesByVendor = [:]
                    confirmedLegacyProducerStatus = .unread
                    return
                }
                let statusSnapshot = await loadMyOrderProducerStatuses(orderId: orderId)
                confirmedProducerStatusesByVendor = statusSnapshot.byVendor
                confirmedLegacyProducerStatus = statusSnapshot.legacyStatus
            }
            .overlay {
                if let checkoutAlert {
                    checkoutDialog(checkoutAlert)
                }
            }
        }
    }
}
