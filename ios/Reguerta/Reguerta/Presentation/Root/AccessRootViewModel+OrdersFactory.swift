extension AccessRootViewModel {
    static func makeMyOrderFreshnessViewModel(
        productsViewModel: ProductsRouteViewModel,
        dependencies: MyOrderFreshnessFeatureDependencies
    ) -> MyOrderFreshnessViewModel {
        MyOrderFreshnessViewModel(
            resolveCriticalDataFreshness: dependencies.resolveCriticalDataFreshness,
            criticalDataFreshnessLocalRepository: dependencies.criticalDataFreshnessLocalRepository,
            sessionStateRevisionProvider: {
                productsViewModel.sessionViewModel.sessionStateRevision
            },
            applyCriticalOrderingState: { context, payload in
                try await productsViewModel.refreshOrderingProductsForFreshness(
                    context: context,
                    payload: payload
                )
            },
            isCriticalOrderingStateCurrent: { context in
                productsViewModel.isOrderingStateCurrentForFreshness(context: context)
            },
            acknowledgedCriticalOrderingStateRevision: { context in
                guard productsViewModel.isOrderingStateCurrentForFreshness(context: context) else { return nil }
                return productsViewModel.sessionViewModel.sessionStateRevision
            }
        )
    }

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

    static func makeReceivedOrdersHistoryViewModel(
        sessionViewModel: SessionViewModel,
        dependencies: OrdersFeatureDependencies
    ) -> ReceivedOrdersHistoryRouteViewModel {
        ReceivedOrdersHistoryRouteViewModel(
            sessionViewModel: sessionViewModel,
            ordersRepository: dependencies.ordersRepository
        )
    }
}
