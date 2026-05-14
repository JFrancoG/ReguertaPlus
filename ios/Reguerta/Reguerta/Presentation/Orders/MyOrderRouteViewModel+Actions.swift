import Foundation

extension MyOrderRouteViewModel {
    func appear(context newContext: MyOrderRouteContext) async {
        context = newContext
        if restoredCartStorageKey != cartStorageKey {
            await restoreCartState(storageKey: cartStorageKey)
        }
        sanitizeSelectedStateForCurrentProducts()
        await loadPreviousOrderIfNeeded()
        await loadProducerStatusesIfNeeded()
    }

    func clearSearch() {
        searchQuery = ""
    }

    func toggleCart() {
        guard selectedUnits > 0, !isReadOnlyMode else { return }
        isCartVisible.toggle()
    }

    func handleCartOpenRequest(_ requestCount: Int) {
        guard requestCount > 0 else { return }
        toggleCart()
    }

    func closeCartOverlay() {
        if isReadOnlyConfirmedView {
            isViewingConfirmedOrder = false
        }
        isCartVisible = false
    }

    func resetCartOverlayForRouteEntry() {
        isCartVisible = false
    }

    func editConfirmedOrder() {
        isViewingConfirmedOrder = false
    }

    func retryPreviousOrder() async {
        let targetWeekKey = isConsultaPhase ? consultaWindow.previousWeekKey : currentWeekKey
        await loadPreviousWeekOrderState(previousWeekKey: targetWeekKey)
    }

    func validateCheckout() async {
        let validation = validateMyOrderCheckout(
            currentMember: currentMember,
            members: members,
            products: products,
            seasonalCommitments: seasonalCommitments,
            selectedQuantities: selectedQuantities,
            selectedEcoBasketOptions: selectedEcoBasketOptions,
            currentWeekParity: currentWeekParity
        )
        if let alert = checkoutAlertForValidation(validation) {
            checkoutAlert = alert
            return
        }
        await submitValidatedCheckout()
    }

    func dismissCheckoutAlert() {
        checkoutAlert = nil
    }

    func acknowledgeCheckoutSuccess() {
        checkoutAlert = nil
        isCartVisible = false
    }

    func selectEcoBasketOption(productId: String, option: String) {
        guard option == ecoBasketOptionPickup || option == ecoBasketOptionNoPickup else { return }
        selectedEcoBasketOptions[productId] = option
        persistCurrentCartSnapshotSoon()
    }

    func increase(_ product: Product) {
        guard !isReadOnlyMode else { return }
        let currentQuantity = selectedQuantities[product.id, default: 0]
        guard canIncrease(product: product, currentQuantity: currentQuantity) else { return }
        selectedQuantities[product.id] = currentQuantity + 1
        if product.isEcoBasket, selectedEcoBasketOptions[product.id] == nil {
            selectedEcoBasketOptions[product.id] = ecoBasketOptionPickup
        }
        persistCurrentCartSnapshotSoon()
    }

    func decrease(_ product: Product) {
        guard !isReadOnlyMode else { return }
        let currentQuantity = selectedQuantities[product.id, default: 0]
        guard currentQuantity > 0 else { return }
        if currentQuantity == 1 {
            selectedQuantities.removeValue(forKey: product.id)
            if product.isEcoBasket {
                selectedEcoBasketOptions.removeValue(forKey: product.id)
            }
        } else {
            selectedQuantities[product.id] = currentQuantity - 1
        }
        if selectedQuantities.isEmpty {
            isCartVisible = false
        }
        persistCurrentCartSnapshotSoon()
    }

    func packContainerLine(for product: Product) -> String {
        if let packContainerName = product.packContainerName, packContainerName.isNotEmpty {
            let quantity = (product.packContainerQty ?? product.unitQty).myOrderUiDecimal
            let unit = product.packContainerAbbreviation ??
                product.packContainerPlural ??
                product.unitAbbreviation ??
                product.unitName
            return "\(packContainerName) \(quantity) \(unit)".trimmingCharacters(in: .whitespaces)
        }
        let fallbackUnit = product.unitQty == 1 ? product.unitName : product.unitPlural
        return "\(fallbackUnit) \(product.unitQty.myOrderUiDecimal)".trimmingCharacters(in: .whitespaces)
    }

    func finiteStockLimit(for product: Product) -> Int? {
        guard product.stockMode == .finite else { return nil }
        let stock = max(0, product.stockQty ?? 0)
        return Int(stock.rounded(.down))
    }

    func canIncrease(product: Product, currentQuantity: Int) -> Bool {
        if let commitmentLimit = seasonalCommitmentUnitLimitsByProductId[product.id],
           currentQuantity >= commitmentLimit {
            return false
        }
        guard let finiteLimit = finiteStockLimit(for: product) else { return true }
        return currentQuantity < finiteLimit
    }

    func quantity(for product: Product) -> Int {
        selectedQuantities[product.id, default: 0]
    }

    func selectedEcoBasketOption(for product: Product) -> String {
        selectedEcoBasketOptions[product.id] ?? ecoBasketOptionPickup
    }

    func sanitizeSelectedStateForCurrentProducts() {
        guard !context.isLoading else { return }
        guard !products.isEmpty || selectedQuantities.isEmpty else { return }
        let productsById = Dictionary(uniqueKeysWithValues: products.map { ($0.id, $0) })
        let sanitizedQuantities = sanitizedSelectedQuantities(productsById: productsById)
        let sanitizedOptions = sanitizedEcoBasketOptions(
            sanitizedQuantities: sanitizedQuantities,
            productsById: productsById
        )
        let didChange = sanitizedQuantities != selectedQuantities || sanitizedOptions != selectedEcoBasketOptions
        selectedQuantities = sanitizedQuantities
        selectedEcoBasketOptions = sanitizedOptions
        if selectedQuantities.isEmpty {
            isCartVisible = false
        }
        if didChange {
            persistCurrentCartSnapshotSoon()
        }
    }

    func sanitizedSelectedQuantities(productsById: [String: Product]) -> [String: Int] {
        selectedQuantities.reduce(into: [String: Int]()) { partialResult, entry in
            guard let product = productsById[entry.key] else { return }
            guard entry.value > 0 else { return }
            let stockLimitedQuantity: Int
            if let finiteLimit = finiteStockLimit(for: product) {
                stockLimitedQuantity = min(entry.value, finiteLimit)
            } else {
                stockLimitedQuantity = entry.value
            }
            let allowedQuantity = min(
                stockLimitedQuantity,
                seasonalCommitmentUnitLimitsByProductId[entry.key] ?? stockLimitedQuantity
            )
            if allowedQuantity > 0 {
                partialResult[entry.key] = allowedQuantity
            }
        }
    }

    func sanitizedEcoBasketOptions(
        sanitizedQuantities: [String: Int],
        productsById: [String: Product]
    ) -> [String: String] {
        sanitizedQuantities.reduce(into: [String: String]()) { partialResult, entry in
            guard entry.value > 0 else { return }
            guard let product = productsById[entry.key], product.isEcoBasket else { return }
            let option = selectedEcoBasketOptions[entry.key]
            if option == ecoBasketOptionPickup || option == ecoBasketOptionNoPickup {
                partialResult[entry.key] = option
            } else {
                partialResult[entry.key] = ecoBasketOptionPickup
            }
        }
    }

    func checkoutAlertForValidation(_ validation: MyOrderCheckoutValidationResult) -> MyOrderCheckoutAlert? {
        if validation.hasEcoBasketPriceMismatch {
            return .ecoBasketPriceMismatch
        }
        if !validation.incompatibleCommitmentProductNames.isEmpty {
            return .incompatibleCommitments(validation.incompatibleCommitmentProductNames)
        }
        if !validation.missingCommitmentProductNames.isEmpty {
            return .missingCommitments(validation.missingCommitmentProductNames)
        }
        if !validation.exceededCommitmentProductNames.isEmpty {
            return .exceededCommitments(validation.exceededCommitmentProductNames)
        }
        return nil
    }
}
