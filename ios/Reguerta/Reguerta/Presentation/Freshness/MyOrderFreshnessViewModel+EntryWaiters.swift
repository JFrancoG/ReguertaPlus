import Foundation

/// One entry caller's continuation, bound to the operation generation and authorization snapshot
/// that are allowed to resolve it.
struct FreshnessEntryWaiter {
    let generation: UInt64
    let identity: MyOrderFreshnessSessionContext
    let continuation: CheckedContinuation<Bool, Never>
}

extension MyOrderFreshnessViewModel {
    var freshnessEntryWaiterCount: Int { freshnessEntryWaiters.count }

    /// Waits for the matching freshness operation without taking ownership of the shared refresh.
    ///
    /// Ownership and state are checked both before suspension and inside continuation registration.
    /// This closes the actor-queue race where invalidation starts a successor after the caller is
    /// enqueued but before its waiter is inserted. Cancellation resolves only this waiter.
    func waitForFreshnessEntryResolution(
        generation: UInt64,
        identity: MyOrderFreshnessSessionContext
    ) async -> Bool {
        let waiterID = UUID()
        if let result = freshnessEntryWaiterRegistrationResult(generation: generation, identity: identity) {
            return result
        }
        return await withTaskCancellationHandler {
            guard !Task.isCancelled else { return false }
            return await withCheckedContinuation { continuation in
                guard !Task.isCancelled else {
                    continuation.resume(returning: false)
                    return
                }
                if let result = freshnessEntryWaiterRegistrationResult(
                    generation: generation,
                    identity: identity
                ) {
                    continuation.resume(returning: result)
                    return
                }
                freshnessEntryWaiters[waiterID] = FreshnessEntryWaiter(
                    generation: generation,
                    identity: identity,
                    continuation: continuation
                )
            }
        } onCancel: {
            Task { @MainActor [weak self] in
                self?.resolveFreshnessEntryWaiter(waiterID, result: false)
            }
        }
    }

    func resolveFreshnessEntryWaiters(generation: UInt64, result: Bool) {
        let waiterIDs = freshnessEntryWaiters.compactMap { waiterID, waiter in
            waiter.generation == generation ? waiterID : nil
        }
        for waiterID in waiterIDs {
            resolveFreshnessEntryWaiter(waiterID, result: result)
        }
    }

    func resolveFreshnessEntryWaiters(
        generation: UInt64,
        identity: MyOrderFreshnessSessionContext,
        result: Bool
    ) {
        let waiterIDs = freshnessEntryWaiters.compactMap { waiterID, waiter in
            waiter.generation == generation && waiter.identity == identity ? waiterID : nil
        }
        for waiterID in waiterIDs {
            resolveFreshnessEntryWaiter(waiterID, result: result)
        }
    }

    private func resolveFreshnessEntryWaiter(_ waiterID: UUID, result: Bool) {
        freshnessEntryWaiters.removeValue(forKey: waiterID)?.continuation.resume(returning: result)
    }
}
