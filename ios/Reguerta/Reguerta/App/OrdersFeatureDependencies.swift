import FirebaseFirestore
import Foundation

struct OrdersFeatureDependencies {
    let ordersRepository: any OrdersRepository
    let cartStore: any MyOrderCartStore
    let nowMillisProvider: @MainActor () -> Int64

    static func live(
        db: Firestore,
        userDefaults: UserDefaults = .standard,
        nowMillisProvider: @escaping @MainActor () -> Int64
    ) -> OrdersFeatureDependencies {
        OrdersFeatureDependencies(
            ordersRepository: FirestoreOrdersRepository(db: db),
            cartStore: UserDefaultsMyOrderCartStore(userDefaults: userDefaults),
            nowMillisProvider: nowMillisProvider
        )
    }

    static func preview(
        ordersRepository: InMemoryOrdersRepository = InMemoryOrdersRepository(),
        cartStore: InMemoryMyOrderCartStore = InMemoryMyOrderCartStore(),
        nowMillisProvider: @escaping @MainActor () -> Int64 = { 0 }
    ) -> OrdersFeatureDependencies {
        OrdersFeatureDependencies(
            ordersRepository: ordersRepository,
            cartStore: cartStore,
            nowMillisProvider: nowMillisProvider
        )
    }
}
