import Foundation

struct UserDefaultsMyOrderCartStore: ImmediateMyOrderCartStore {
    private let storedUserDefaults: UserDefaults

    func readCart(storageKey: String) async -> MyOrderCartSnapshot {
        readMyOrderCartSnapshot(userDefaults: storedUserDefaults, storageKey: storageKey)
    }

    func persistCart(storageKey: String, snapshot: MyOrderCartSnapshot) async {
        persistCartImmediately(storageKey: storageKey, snapshot: snapshot)
    }

    func persistCartImmediately(storageKey: String, snapshot: MyOrderCartSnapshot) {
        persistMyOrderCartSnapshot(
            userDefaults: storedUserDefaults,
            storageKey: storageKey,
            selectedQuantities: snapshot.selectedQuantities,
            selectedEcoBasketOptions: snapshot.selectedEcoBasketOptions
        )
        _ = storedUserDefaults.synchronize()
    }

    func readConfirmed(storageKey: String) async -> MyOrderCartSnapshot {
        readMyOrderConfirmedSnapshot(userDefaults: storedUserDefaults, storageKey: storageKey)
    }

    func persistConfirmed(storageKey: String, snapshot: MyOrderCartSnapshot) async {
        persistMyOrderConfirmedSnapshot(
            userDefaults: storedUserDefaults,
            storageKey: storageKey,
            selectedQuantities: snapshot.selectedQuantities,
            selectedEcoBasketOptions: snapshot.selectedEcoBasketOptions
        )
        _ = storedUserDefaults.synchronize()
    }
}

extension UserDefaultsMyOrderCartStore {
    init(userDefaults: UserDefaults = .standard) {
        self.storedUserDefaults = userDefaults
    }
}

actor InMemoryMyOrderCartStore: MyOrderCartStore {
    private var cartSnapshots: [String: MyOrderCartSnapshot] = [:]
    private var confirmedSnapshots: [String: MyOrderCartSnapshot] = [:]

    init() {}

    func readCart(storageKey: String) async -> MyOrderCartSnapshot { cartSnapshots[storageKey] ?? .empty }

    func persistCart(storageKey: String, snapshot: MyOrderCartSnapshot) async {
        cartSnapshots[storageKey] = snapshot.normalized
    }

    func readConfirmed(storageKey: String) async -> MyOrderCartSnapshot { confirmedSnapshots[storageKey] ?? .empty }

    func persistConfirmed(storageKey: String, snapshot: MyOrderCartSnapshot) async {
        confirmedSnapshots[storageKey] = snapshot.normalized
    }

    func seedCart(_ snapshot: MyOrderCartSnapshot, storageKey: String) {
        cartSnapshots[storageKey] = snapshot.normalized
    }

    func seedConfirmed(_ snapshot: MyOrderCartSnapshot, storageKey: String) {
        confirmedSnapshots[storageKey] = snapshot.normalized
    }
}
