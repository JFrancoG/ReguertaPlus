import Foundation

extension MyOrderRouteViewModel {
    var normalizedQuery: String {
        searchQuery.searchNormalized
    }

    var products: [Product] {
        context.products
    }

    var seasonalCommitments: [SeasonalCommitment] {
        context.seasonalCommitments
    }

    var currentMember: Member? {
        context.currentMember
    }

    var members: [Member] {
        context.members
    }

    var nowMillis: Int64 {
        context.nowMillis
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

    var shouldShowDatabaseOrderSummary: Bool {
        isConsultaPhase || (!hasConfirmedOrder && previousOrderState.isLoaded)
    }

    var consultaWindow: MyOrderConsultaWindow {
        resolveMyOrderConsultaWindow(
            defaultDeliveryDayOfWeek: context.defaultDeliveryDayOfWeek,
            deliveryCalendarOverrides: context.deliveryCalendarOverrides,
            shifts: context.shifts,
            now: Date(timeIntervalSince1970: TimeInterval(nowMillis) / 1_000)
        )
    }

    var isConsultaPhase: Bool {
        consultaWindow.isConsultaPhase
    }

    var isReadOnlyMode: Bool {
        isReadOnlyConfirmedView || shouldShowDatabaseOrderSummary
    }

    var consultaTaskID: String {
        let memberId = currentMember?.id ?? ""
        let targetWeekKey = isConsultaPhase ? consultaWindow.previousWeekKey : currentWeekKey
        return "\(isConsultaPhase)-\(targetWeekKey)-\(memberId)"
    }

    var finalizeCheckoutTitle: String {
        "Finalizar pedido"
    }

    var canSubmitCheckout: Bool {
        !isSubmittingCheckout &&
            !isReadOnlyMode &&
            selectedUnits > 0 &&
            (!hasConfirmedOrder || hasPendingConfirmedEdits)
    }

    var cartTotal: Double {
        selectedProducts.reduce(0) { partial, product in
            partial + product.selectedQuantity(
                selectionCount: selectedQuantities[product.id, default: 0]
            ) * product.price
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
            let quantityAtOrder = product.selectedQuantity(selectionCount: unitsSelected)
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
}
