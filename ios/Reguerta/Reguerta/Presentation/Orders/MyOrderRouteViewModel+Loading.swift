import Foundation

extension MyOrderRouteViewModel {
    func restoreCartState(storageKey: String) async {
        let cartSnapshot = await cartStore.readCart(storageKey: storageKey)
        let confirmedSnapshot = await cartStore.readConfirmed(storageKey: storageKey)
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
        if initialSelectionSnapshot.selectedQuantities.isEmpty || isViewingConfirmedOrder {
            isCartVisible = false
        }
        if confirmedSnapshot.selectedQuantities.isEmpty {
            confirmedProducerStatusesByVendor = [:]
            confirmedLegacyProducerStatus = .unread
        }
        hasRestoredCartState = true
        restoredCartStorageKey = storageKey
    }

    func loadPreviousOrderIfNeeded() async {
        guard isConsultaPhase || !hasConfirmedOrder else {
            loadedConsultaTaskID = nil
            return
        }
        guard loadedConsultaTaskID != consultaTaskID else { return }
        loadedConsultaTaskID = consultaTaskID
        let targetWeekKey = isConsultaPhase ? consultaWindow.previousWeekKey : currentWeekKey
        await loadPreviousWeekOrderState(previousWeekKey: targetWeekKey)
    }

    func loadPreviousWeekOrderState(previousWeekKey: String) async {
        previousOrderState = .loading
        do {
            let snapshot = try await ordersRepository.previousOrderSnapshot(
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

    func loadProducerStatusesIfNeeded() async {
        guard !isConsultaPhase, hasConfirmedOrder, let orderId = currentOrderId else {
            loadedStatusTaskID = nil
            confirmedProducerStatusesByVendor = [:]
            confirmedLegacyProducerStatus = .unread
            return
        }
        let taskID = "\(orderId)-\(hasConfirmedOrder)-\(isConsultaPhase)"
        guard loadedStatusTaskID != taskID else { return }
        loadedStatusTaskID = taskID
        let statusSnapshot = await ordersRepository.myOrderProducerStatuses(orderId: orderId)
        confirmedProducerStatusesByVendor = statusSnapshot.byVendor
        confirmedLegacyProducerStatus = statusSnapshot.legacyStatus
    }

    func submitValidatedCheckout() async {
        isSubmittingCheckout = true
        let request = MyOrderCheckoutRequest(
            currentMember: currentMember,
            weekKey: currentWeekKey,
            products: products,
            selectedQuantities: selectedQuantities,
            selectedEcoBasketOptions: selectedEcoBasketOptions,
            nowMillis: nowMillisProvider()
        )
        let didPersist = await ordersRepository.submitMyOrder(request)
        isSubmittingCheckout = false

        guard didPersist else {
            checkoutAlert = .submitFailed
            return
        }
        await applySuccessfulCheckoutState()
    }

    func applySuccessfulCheckoutState() async {
        let snapshot = MyOrderCartSnapshot(
            selectedQuantities: selectedQuantities,
            selectedEcoBasketOptions: selectedEcoBasketOptions
        )
        await cartStore.persistConfirmed(storageKey: cartStorageKey, snapshot: snapshot)
        confirmedQuantities = selectedQuantities
        confirmedEcoBasketOptions = selectedEcoBasketOptions
        isViewingConfirmedOrder = true
        checkoutAlert = .readyToSubmit(
            total: cartTotal,
            noPickupEcoBaskets: noPickupEcoBasketUnits
        )
        loadedStatusTaskID = nil
        await loadProducerStatusesIfNeeded()
    }

    func persistCurrentCartSnapshotSoon() {
        persistCurrentCartSnapshotIfNeeded()
    }

    func persistCurrentCartSnapshotIfNeeded() {
        guard hasRestoredCartState else { return }
        let snapshot = MyOrderCartSnapshot(
            selectedQuantities: selectedQuantities,
            selectedEcoBasketOptions: selectedEcoBasketOptions
        )
        if let immediateCartStore = cartStore as? any ImmediateMyOrderCartStore {
            immediateCartStore.persistCartImmediately(storageKey: cartStorageKey, snapshot: snapshot)
            return
        }

        let storageKey = cartStorageKey
        let cartStore = cartStore
        Task {
            await cartStore.persistCart(storageKey: storageKey, snapshot: snapshot)
        }
    }
}
