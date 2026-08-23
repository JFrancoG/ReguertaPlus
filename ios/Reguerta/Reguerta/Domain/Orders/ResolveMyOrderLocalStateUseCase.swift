enum MyOrderLocalState: Equatable {
    case empty
    case draft
    case confirmed
}

struct ResolveMyOrderLocalStateUseCase {
    private let storedCartStore: any MyOrderCartStore

    /// Resolves the locally persisted order state for one exact member, order week, and environment.
    ///
    /// A non-empty confirmed snapshot takes precedence and avoids reading the editable draft. When
    /// no confirmation exists, a non-empty draft is returned; invalid or empty quantities resolve
    /// to `.empty`. The operation only reads local state and never mutates either snapshot.
    func execute(scope: MyOrderLocalStateScope) async -> MyOrderLocalState {
        let confirmedSnapshot = await storedCartStore.readConfirmed(storageKey: scope.storageKey)
        if !confirmedSnapshot.normalized.selectedQuantities.isEmpty {
            return .confirmed
        }

        let cartSnapshot = await storedCartStore.readCart(storageKey: scope.storageKey)
        return cartSnapshot.normalized.selectedQuantities.isEmpty ? .empty : .draft
    }
}

extension ResolveMyOrderLocalStateUseCase {
    init(cartStore: any MyOrderCartStore) {
        self.storedCartStore = cartStore
    }
}
