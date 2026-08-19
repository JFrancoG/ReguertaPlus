import Foundation

extension MyOrderRouteViewModel {
    func restoreCartState(storageKey: String, contextOperation: ContextOperation) async {
        guard isCurrent(contextOperation) else { return }
        let cartStore = cartStore
        let cartSnapshot = await cartStore.readCart(storageKey: storageKey)
        guard !Task.isCancelled, isCurrent(contextOperation) else { return }
        let confirmedSnapshot = await cartStore.readConfirmed(storageKey: storageKey)
        guard !Task.isCancelled, isCurrent(contextOperation) else { return }

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

    func loadPreviousOrderIfNeeded(contextOperation: ContextOperation) async {
        guard isCurrent(contextOperation) else { return }
        let operationContext = contextOperation.context
        let consultaWindow = operationContext.consultaWindow
        guard consultaWindow.isConsultaPhase || !hasConfirmedOrder else {
            invalidatePreviousOrderOperation()
            loadedConsultaTaskID = nil
            consultaLoadOwnerGeneration = nil
            return
        }
        let targetWeekKey = consultaWindow.isConsultaPhase
            ? consultaWindow.previousWeekKey
            : operationContext.currentWeekKey
        let taskID = "\(operationContext.identity)|previous-order|\(targetWeekKey)"
        if loadedConsultaTaskID == taskID {
            if consultaLoadOwnerGeneration == contextOperation.generation { return }
            if consultaLoadOwnerGeneration == nil { return }
        }
        loadedConsultaTaskID = taskID
        consultaLoadOwnerGeneration = contextOperation.generation
        let didComplete = await loadPreviousWeekOrderState(
            previousWeekKey: targetWeekKey,
            contextOperation: contextOperation
        )
        finishConsultaLoad(taskID: taskID, contextOperation: contextOperation, completed: didComplete)
    }

    @discardableResult
    func loadPreviousWeekOrderState(previousWeekKey: String, contextOperation: ContextOperation) async -> Bool {
        guard isCurrent(contextOperation) else { return false }
        let operation = beginPreviousOrderOperation(for: contextOperation)
        let operationContext = contextOperation.context
        let ordersRepository = ordersRepository
        let fallbackState: MyOrderPreviousOrderState
        if case .loading = previousOrderState {
            fallbackState = .empty
        } else {
            fallbackState = previousOrderState
        }
        previousOrderState = .loading
        defer { finishPreviousOrderOperation(operation, fallback: fallbackState) }
        do {
            let snapshot = try await ordersRepository.previousOrderSnapshot(
                currentMember: operationContext.currentMember,
                previousWeekKey: previousWeekKey,
                environment: operationContext.environment
            )
            try Task.checkCancellation()
            guard isCurrent(operation) else { return false }
            if let snapshot, !snapshot.groups.isEmpty {
                previousOrderState = .loaded(snapshot)
            } else {
                previousOrderState = .empty
            }
            return true
        } catch is CancellationError {
            return false
        } catch {
            guard isCurrent(operation) else { return false }
            previousOrderState = .error
            return true
        }
    }

    private func finishPreviousOrderOperation(
        _ operation: PreviousOrderOperation,
        fallback: MyOrderPreviousOrderState
    ) {
        guard previousOrderOperationGeneration == operation.generation else { return }
        if case .loading = previousOrderState {
            previousOrderState = fallback
        }
    }

    func loadProducerStatusesIfNeeded(contextOperation: ContextOperation) async {
        guard isCurrent(contextOperation) else { return }
        let operationContext = contextOperation.context
        guard !operationContext.consultaWindow.isConsultaPhase,
              hasConfirmedOrder,
              let currentMember = operationContext.currentMember else {
            invalidateProducerStatusOperation()
            loadedStatusTaskID = nil
            statusLoadOwnerGeneration = nil
            confirmedProducerStatusesByVendor = [:]
            confirmedLegacyProducerStatus = .unread
            return
        }
        let taskID = "\(operationContext.identity)|producer-status|\(currentMember.id)"
        if loadedStatusTaskID == taskID {
            if statusLoadOwnerGeneration == contextOperation.generation { return }
            if statusLoadOwnerGeneration == nil { return }
        }
        loadedStatusTaskID = taskID
        statusLoadOwnerGeneration = contextOperation.generation
        let operation = beginProducerStatusOperation(for: contextOperation)
        let ordersRepository = ordersRepository
        let statusSnapshot = await ordersRepository.myOrderProducerStatuses(
            currentMember: currentMember,
            weekKey: operationContext.currentWeekKey,
            environment: operationContext.environment
        )
        guard !Task.isCancelled, isCurrent(operation) else {
            finishStatusLoad(taskID: taskID, contextOperation: contextOperation, completed: false)
            return
        }
        confirmedProducerStatusesByVendor = statusSnapshot.byVendor
        confirmedLegacyProducerStatus = statusSnapshot.legacyStatus
        finishStatusLoad(taskID: taskID, contextOperation: contextOperation, completed: true)
    }

    private func finishConsultaLoad(taskID: String, contextOperation: ContextOperation, completed: Bool) {
        guard loadedConsultaTaskID == taskID, consultaLoadOwnerGeneration == contextOperation.generation else { return }
        consultaLoadOwnerGeneration = nil
        if !completed {
            loadedConsultaTaskID = nil
            if case .loading = previousOrderState {
                previousOrderState = .empty
            }
        }
    }

    private func finishStatusLoad(taskID: String, contextOperation: ContextOperation, completed: Bool) {
        guard loadedStatusTaskID == taskID, statusLoadOwnerGeneration == contextOperation.generation else { return }
        statusLoadOwnerGeneration = nil
        if !completed {
            loadedStatusTaskID = nil
        }
    }

    private func beginCheckoutOperation(for contextOperation: ContextOperation) -> CheckoutOperation {
        let operationContext = contextOperation.context
        let snapshot = MyOrderCartSnapshot(
            selectedQuantities: selectedQuantities,
            selectedEcoBasketOptions: selectedEcoBasketOptions
        )
        let request = MyOrderCheckoutRequest(
            currentMember: operationContext.currentMember,
            weekKey: operationContext.currentWeekKey,
            products: operationContext.products,
            selectedQuantities: snapshot.selectedQuantities,
            selectedEcoBasketOptions: snapshot.selectedEcoBasketOptions,
            nowMillis: nowMillisProvider()
        )
        let total = operationContext.products.reduce(0) { partialResult, product in
            let selectionCount = snapshot.selectedQuantities[product.id, default: 0]
            return partialResult + product.selectedQuantity(selectionCount: selectionCount) * product.price
        }
        let noPickupEcoBaskets = countNoPickupEcoBasketUnits(
            products: operationContext.products,
            selectedQuantities: snapshot.selectedQuantities,
            selectedEcoBasketOptions: snapshot.selectedEcoBasketOptions
        )
        checkoutOperationGeneration &+= 1
        return CheckoutOperation(
            contextOperation: contextOperation,
            generation: checkoutOperationGeneration,
            request: request,
            snapshot: snapshot,
            storageKey: operationContext.cartStorageKey,
            total: total,
            noPickupEcoBaskets: noPickupEcoBaskets
        )
    }

    func submitValidatedCheckout() async {
        let contextOperation = captureContextOperation()
        guard isCurrent(contextOperation) else { return }
        let operation = beginCheckoutOperation(for: contextOperation)
        let ordersRepository = ordersRepository
        isSubmittingCheckout = true
        defer { finishCheckoutOperation(operation) }

        let didPersist: Bool
        do {
            try Task.checkCancellation()
            didPersist = try await ordersRepository.submitMyOrder(
                operation.request,
                environment: operation.contextOperation.context.environment
            )
            try Task.checkCancellation()
        } catch is CancellationError {
            return
        } catch {
            guard isCurrent(operation) else { return }
            checkoutAlert = .submitFailed
            return
        }
        guard isCurrent(operation) else { return }
        guard didPersist else {
            checkoutAlert = .submitFailed
            return
        }
        await applySuccessfulCheckoutState(operation: operation)
    }

    private func finishCheckoutOperation(_ operation: CheckoutOperation) {
        guard checkoutOperationGeneration == operation.generation else { return }
        isSubmittingCheckout = false
    }

    func applySuccessfulCheckoutState(operation: CheckoutOperation) async {
        guard isCurrent(operation) else { return }
        let cartStore = cartStore
        await cartStore.persistConfirmed(storageKey: operation.storageKey, snapshot: operation.snapshot)
        guard !Task.isCancelled, isCurrent(operation) else { return }

        confirmedQuantities = operation.snapshot.selectedQuantities
        confirmedEcoBasketOptions = operation.snapshot.selectedEcoBasketOptions
        isViewingConfirmedOrder = true
        checkoutAlert = .readyToSubmit(
            total: operation.total,
            noPickupEcoBaskets: operation.noPickupEcoBaskets
        )
        invalidatePreviousOrderOperation()
        loadedStatusTaskID = nil
        statusLoadOwnerGeneration = nil
        let statusContextOperation = ContextOperation(
            context: operation.contextOperation.context,
            generation: contextGeneration,
            sessionStateRevision: contextSessionStateRevision
        )
        await loadProducerStatusesIfNeeded(contextOperation: statusContextOperation)
    }

    func persistCurrentCartSnapshotSoon() {
        persistCurrentCartSnapshotIfNeeded()
    }

    func persistCurrentCartSnapshotIfNeeded() {
        guard hasRestoredCartState,
              ordersRouteHasActiveAuthorization(
                  sessionViewModel: sessionViewModel,
                  currentMember: context.currentMember,
                  environment: context.environment
              ) else { return }
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
