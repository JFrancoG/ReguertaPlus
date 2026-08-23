extension MyOrderRouteViewModel {
    func enqueueCartPersistence(snapshot: MyOrderCartSnapshot) {
        cartPersistenceRequestGeneration &+= 1
        pendingCartPersistenceRequest = CartPersistenceRequest(
            generation: cartPersistenceRequestGeneration,
            storageKey: cartStorageKey,
            snapshot: snapshot,
            currentMember: context.currentMember,
            environment: context.environment,
            sessionStateRevision: sessionViewModel.sessionStateRevision
        )
        startCartPersistenceWorkerIfNeeded()
    }

    func invalidateCartPersistenceForSessionChange() {
        invalidateCartPersistenceOwner()
    }

    func invalidateCartPersistenceForContextChange() {
        invalidateCartPersistenceOwner()
    }

    private func invalidateCartPersistenceOwner() {
        cartPersistenceRequestGeneration &+= 1
        pendingCartPersistenceRequest = nil
        cartPersistenceTask?.cancel()
    }

    /// Starts the single serial persistence worker when a valid snapshot is pending.
    ///
    /// Enqueueing during an in-flight write overwrites the pending request, coalescing backpressure
    /// to the latest snapshot. A cancelled write that ignores cancellation keeps this retained task
    /// as the ownership barrier; owner-only completion then releases it and starts the latest valid
    /// successor for the current storage key and session generation.
    private func startCartPersistenceWorkerIfNeeded() {
        guard cartPersistenceTask == nil, pendingCartPersistenceRequest != nil else { return }
        cartPersistenceTaskGeneration &+= 1
        let taskGeneration = cartPersistenceTaskGeneration
        let cartStore = cartStore
        cartPersistenceTask = Task { @MainActor [weak self, cartStore] in
            while !Task.isCancelled {
                guard let request = self?.takeNextCartPersistenceRequest(taskGeneration: taskGeneration) else {
                    break
                }
                await cartStore.persistCart(storageKey: request.storageKey, snapshot: request.snapshot)
            }
            self?.finishCartPersistenceWorker(taskGeneration: taskGeneration)
        }
    }

    private func takeNextCartPersistenceRequest(taskGeneration: UInt64) -> CartPersistenceRequest? {
        guard taskGeneration == cartPersistenceTaskGeneration,
              let request = pendingCartPersistenceRequest else { return nil }
        pendingCartPersistenceRequest = nil
        guard request.generation == cartPersistenceRequestGeneration,
              request.storageKey == cartStorageKey,
              request.sessionStateRevision == sessionViewModel.sessionStateRevision,
              ordersRouteHasActiveAuthorization(
                  sessionViewModel: sessionViewModel,
                  currentMember: request.currentMember,
                  environment: request.environment
              ) else { return nil }
        return request
    }

    private func finishCartPersistenceWorker(taskGeneration: UInt64) {
        guard taskGeneration == cartPersistenceTaskGeneration else { return }
        cartPersistenceTask = nil
        startCartPersistenceWorkerIfNeeded()
    }
}
