import FirebaseFirestore
import SwiftUI

private let myOrderCommonPurchasesGroupId = "__my_order_reguerta_common_purchases__"
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

    var normalizedQuery: String {
        searchQuery.searchNormalized
    }

    var currentWeekParity: ProducerParity {
        currentISOWeekProducerParity(nowMillis: nowMillis)
    }

    var selectedProducts: [Product] {
        products.filter { selectedQuantities[$0.id, default: 0] > 0 }
    }

    var selectedUnits: Int {
        selectedQuantities.values.reduce(0, +)
    }

    var hasConfirmedOrder: Bool {
        !confirmedQuantities.isEmpty
    }

    var hasPendingConfirmedEdits: Bool {
        hasConfirmedOrder && (
            selectedQuantities != confirmedQuantities ||
                selectedEcoBasketOptions != confirmedEcoBasketOptions
        )
    }

    var isReadOnlyConfirmedView: Bool {
        hasConfirmedOrder && !hasPendingConfirmedEdits && isViewingConfirmedOrder
    }

    var consultaWindow: MyOrderConsultaWindow {
        resolveMyOrderConsultaWindow(
            defaultDeliveryDayOfWeek: defaultDeliveryDayOfWeek,
            deliveryCalendarOverrides: deliveryCalendarOverrides,
            shifts: shifts,
            now: Date(timeIntervalSince1970: TimeInterval(nowMillis) / 1_000)
        )
    }

    var isConsultaPhase: Bool {
        consultaWindow.isConsultaPhase
    }

    var isReadOnlyMode: Bool {
        isReadOnlyConfirmedView || isConsultaPhase
    }

    var consultaTaskID: String {
        let memberId = currentMember?.id ?? ""
        return "\(isConsultaPhase)-\(consultaWindow.previousWeekKey)-\(memberId)"
    }

    var finalizeCheckoutTitle: String {
        hasConfirmedOrder && hasPendingConfirmedEdits ? "Guardar cambios" : "Finalizar compra"
    }

    var canSubmitCheckout: Bool {
        !isSubmittingCheckout &&
            !isReadOnlyMode &&
            selectedUnits > 0 &&
            (!hasConfirmedOrder || hasPendingConfirmedEdits)
    }

    var cartTotal: Double {
        selectedProducts.reduce(0) { partial, product in
            partial + Double(selectedQuantities[product.id, default: 0]) * product.price
        }
    }

    var noPickupEcoBasketUnits: Int {
        countNoPickupEcoBasketUnits(
            products: products,
            selectedQuantities: selectedQuantities,
            selectedEcoBasketOptions: selectedEcoBasketOptions
        )
    }

    var committedProducerId: String? {
        currentMember?.committedEcoBasketProducerId(in: members)
    }

    var currentWeekKey: String {
        nowMillis.isoWeekKey
    }

    var cartStorageKey: String {
        "member_\(currentMember?.id ?? "")_week_\(currentWeekKey)"
    }

    var currentOrderId: String? {
        guard let memberId = currentMember?.id, memberId.isNotEmpty else { return nil }
        return "\(memberId)_\(currentWeekKey)"
    }

    var groupedProducts: [MyOrderProducerGroup] {
        let filteredProducts = products.filter { product in
            guard normalizedQuery.isNotEmpty else { return true }
            return product.matchesMyOrderSearch(normalizedQuery)
        }

        let commonPurchases = filteredProducts.filter(\.isCommonPurchase)
        let regularProducts = filteredProducts.filter { !$0.isCommonPurchase }

        var groups = Dictionary(grouping: regularProducts, by: \.vendorId)
            .map { vendorId, grouped in
                let sortedProducts = grouped.sorted { lhs, rhs in
                    if lhs.isEcoBasket != rhs.isEcoBasket {
                        return lhs.isEcoBasket && !rhs.isEcoBasket
                    }
                    return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
                }
                return MyOrderProducerGroup(
                    vendorId: vendorId,
                    companyName: grouped.first?.companyName ?? vendorId,
                    products: sortedProducts,
                    hasCommonPurchase: grouped.contains(where: \.isCommonPurchase),
                    isCommittedEcoBasketProducer: vendorId == committedProducerId && grouped.contains(where: \.isEcoBasket),
                    isCommonPurchasesGroup: false
                )
            }

        if !commonPurchases.isEmpty {
            groups.append(
                MyOrderProducerGroup(
                    vendorId: myOrderCommonPurchasesGroupId,
                    companyName: "Compras Regüerta",
                    products: commonPurchases.sorted { lhs, rhs in
                        lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
                    },
                    hasCommonPurchase: true,
                    isCommittedEcoBasketProducer: false,
                    isCommonPurchasesGroup: true
                )
            )
        }

        return groups.sorted { lhs, rhs in
            if lhs.sortPriority != rhs.sortPriority {
                return lhs.sortPriority < rhs.sortPriority
            }
            return lhs.companyName.localizedCaseInsensitiveCompare(rhs.companyName) == .orderedAscending
        }
    }

    var confirmedOrderGroups: [MyOrderConfirmedGroup] {
        let lines = selectedProducts.compactMap { product -> MyOrderConfirmedLine? in
            let unitsSelected = selectedQuantities[product.id, default: 0]
            guard unitsSelected > 0 else { return nil }
            let quantityAtOrder: Double
            if product.pricingMode == .weight {
                quantityAtOrder = Double(unitsSelected) * product.unitQty
            } else {
                quantityAtOrder = Double(unitsSelected)
            }
            return MyOrderConfirmedLine(
                product: product,
                unitsSelected: unitsSelected,
                quantityAtOrder: quantityAtOrder,
                subtotal: quantityAtOrder * product.price
            )
        }

        return Dictionary(grouping: lines, by: { $0.product.vendorId })
            .compactMap { vendorId, groupedLines in
                guard let first = groupedLines.first else { return nil }
                let sortedLines = groupedLines.sorted {
                    $0.product.name.localizedCaseInsensitiveCompare($1.product.name) == .orderedAscending
                }
                return MyOrderConfirmedGroup(
                    vendorId: vendorId,
                    companyName: first.product.companyName,
                    producerStatus: confirmedProducerStatusesByVendor[vendorId] ?? confirmedLegacyProducerStatus,
                    lines: sortedLines,
                    subtotal: sortedLines.reduce(0) { $0 + $1.subtotal }
                )
            }
            .sorted {
                $0.companyName.localizedCaseInsensitiveCompare($1.companyName) == .orderedAscending
            }
    }

    var seasonalCommitmentUnitLimitsByProductId: [String: Int] {
        seasonalCommitmentUnitLimitsByProductID(
            products: products,
            seasonalCommitments: seasonalCommitments
        )
    }

    @ViewBuilder
    var readOnlyOrderContent: some View {
        if isConsultaPhase {
            previousOrderView
        } else {
            confirmedOrderView
        }
    }

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

    func persistCurrentCartSnapshotIfNeeded() {
        guard hasRestoredCartState else { return }
        persistMyOrderCartSnapshot(
            storageKey: cartStorageKey,
            selectedQuantities: selectedQuantities,
            selectedEcoBasketOptions: selectedEcoBasketOptions
        )
    }

    @MainActor
    func loadPreviousWeekOrderState(previousWeekKey: String) async {
        previousOrderState = .loading
        do {
            let snapshot = try await fetchPreviousWeekOrderSnapshot(
                currentMember: currentMember,
                previousWeekKey: previousWeekKey
            )
            if let snapshot, !snapshot.groups.isEmpty {
                previousOrderState = .loaded(snapshot)
            } else {
                previousOrderState = .empty
            }
        } catch {
            previousOrderState = .error
        }
    }

    func sanitizeSelectedStateForCurrentProducts() {
        let productsById = Dictionary(uniqueKeysWithValues: products.map { ($0.id, $0) })
        selectedQuantities = selectedQuantities.reduce(into: [:]) { partialResult, entry in
            guard let product = productsById[entry.key] else { return }
            guard entry.value > 0 else { return }
            var allowedQuantity: Int
            if let finiteLimit = finiteStockLimit(for: product) {
                allowedQuantity = min(entry.value, finiteLimit)
            } else {
                allowedQuantity = entry.value
            }
            if let commitmentLimit = seasonalCommitmentUnitLimitsByProductId[entry.key] {
                allowedQuantity = min(allowedQuantity, commitmentLimit)
            }
            if allowedQuantity > 0 {
                partialResult[entry.key] = allowedQuantity
            }
        }
        selectedEcoBasketOptions = selectedQuantities.reduce(into: [:]) { partialResult, entry in
            guard entry.value > 0 else { return }
            guard let product = productsById[entry.key], product.isEcoBasket else { return }
            let option = selectedEcoBasketOptions[entry.key]
            if option == ecoBasketOptionPickup || option == ecoBasketOptionNoPickup {
                partialResult[entry.key] = option
            } else {
                partialResult[entry.key] = ecoBasketOptionPickup
            }
        }
        if selectedQuantities.isEmpty {
            isCartVisible = false
        }
    }

}
