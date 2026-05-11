import SwiftUI

extension MyOrderRouteView {
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
