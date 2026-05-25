extension AccessRootViewModel {
    static func makeMyOrderViewModel(
        sessionViewModel: SessionViewModel,
        dependencies: OrdersFeatureDependencies
    ) -> MyOrderRouteViewModel {
        MyOrderRouteViewModel(
            sessionViewModel: sessionViewModel,
            ordersRepository: dependencies.ordersRepository,
            cartStore: dependencies.cartStore,
            nowMillisProvider: dependencies.nowMillisProvider
        )
    }

    static func makeReceivedOrdersViewModel(
        sessionViewModel: SessionViewModel,
        dependencies: OrdersFeatureDependencies
    ) -> ReceivedOrdersRouteViewModel {
        ReceivedOrdersRouteViewModel(
            sessionViewModel: sessionViewModel,
            ordersRepository: dependencies.ordersRepository,
            nowMillisProvider: dependencies.nowMillisProvider
        )
    }

    static func makeMyOrdersHistoryViewModel(
        sessionViewModel: SessionViewModel,
        dependencies: OrdersFeatureDependencies
    ) -> MyOrdersHistoryRouteViewModel {
        MyOrdersHistoryRouteViewModel(
            sessionViewModel: sessionViewModel,
            ordersRepository: dependencies.ordersRepository
        )
    }
}
