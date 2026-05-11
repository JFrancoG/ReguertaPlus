import Testing

@testable import Reguerta

@MainActor
func makeMyOrderViewModel(
    repository: InMemoryOrdersRepository? = nil,
    cartStore: InMemoryMyOrderCartStore? = nil,
    nowMillis: Int64? = nil
) -> MyOrderRouteViewModel {
    let resolvedNowMillis = nowMillis ?? testMillis(year: 2026, month: 5, day: 14)
    return MyOrderRouteViewModel(
        sessionViewModel: SessionViewModel(dependencies: .preview()),
        ordersRepository: repository ?? InMemoryOrdersRepository(),
        cartStore: cartStore ?? InMemoryMyOrderCartStore(),
        nowMillisProvider: { resolvedNowMillis }
    )
}

@MainActor
func makeReceivedOrdersViewModel(
    repository: InMemoryOrdersRepository? = nil,
    nowMillis: Int64? = nil
) -> ReceivedOrdersRouteViewModel {
    let resolvedNowMillis = nowMillis ?? testMillis(year: 2026, month: 5, day: 11)
    return ReceivedOrdersRouteViewModel(
        sessionViewModel: SessionViewModel(dependencies: .preview()),
        ordersRepository: repository ?? InMemoryOrdersRepository(),
        nowMillisProvider: { resolvedNowMillis }
    )
}

@MainActor
func myOrderContext(
    products: [Product] = [],
    seasonalCommitments: [SeasonalCommitment] = [],
    nowMillis: Int64? = nil,
    currentMember: Member? = nil
) -> MyOrderRouteContext {
    let resolvedNowMillis = nowMillis ?? testMillis(year: 2026, month: 5, day: 14)
    let resolvedMember = currentMember ?? member(id: "member_1", ecoCommitmentMode: .weekly)
    return MyOrderRouteContext(
        products: products,
        seasonalCommitments: seasonalCommitments,
        shifts: [],
        defaultDeliveryDayOfWeek: .wednesday,
            deliveryCalendarOverrides: [],
        nowMillis: resolvedNowMillis,
        isLoading: false,
        currentMember: resolvedMember,
        members: [resolvedMember, producer(id: "producer_even", parity: .even)]
    )
}

@MainActor
func receivedOrdersContext(
    currentMember: Member,
    nowMillis: Int64
) -> ReceivedOrdersRouteContext {
    ReceivedOrdersRouteContext(
        currentMember: currentMember,
        shifts: [],
        defaultDeliveryDayOfWeek: .wednesday,
        deliveryCalendarOverrides: [],
        nowMillis: nowMillis
    )
}

@MainActor
func finiteStockProduct(_ product: Product, stock: Double) -> Product {
    Product(
        id: product.id,
        vendorId: product.vendorId,
        companyName: product.companyName,
        name: product.name,
        description: product.description,
        productImageUrl: product.productImageUrl,
        price: product.price,
        pricingMode: product.pricingMode,
        unitName: product.unitName,
        unitAbbreviation: product.unitAbbreviation,
        unitPlural: product.unitPlural,
        unitQty: product.unitQty,
        packContainerName: product.packContainerName,
        packContainerAbbreviation: product.packContainerAbbreviation,
        packContainerPlural: product.packContainerPlural,
        packContainerQty: product.packContainerQty,
        isAvailable: product.isAvailable,
        stockMode: .finite,
        stockQty: stock,
        isEcoBasket: product.isEcoBasket,
        isCommonPurchase: product.isCommonPurchase,
        commonPurchaseType: product.commonPurchaseType,
        archived: product.archived,
        createdAtMillis: product.createdAtMillis,
        updatedAtMillis: product.updatedAtMillis
    )
}

@MainActor
func receivedOrdersSnapshot(status: ProducerOrderStatus) -> ReceivedOrdersSnapshot {
    ReceivedOrdersSnapshot(
        byProductRows: [
            ReceivedOrdersProductRow(
                productId: "tomato",
                productName: "Tomates",
                productImageUrl: nil,
                companyName: "Huerta Norte",
                packagingLine: "Caja 1 kg",
                totalQuantity: 3,
                quantityUnitSingular: "caja",
                quantityUnitPlural: "cajas"
            )
        ],
        byMemberGroups: [
            ReceivedOrdersMemberGroup(
                id: "member_1|Carmen",
                orderId: "order_1",
                consumerDisplayName: "Carmen",
                producerStatus: status,
                lines: [
                    ReceivedOrdersMemberLine(
                        id: "order_1|tomato",
                        productName: "Tomates",
                        packagingLine: "Caja 1 kg",
                        quantity: 3,
                        quantityUnitSingular: "caja",
                        quantityUnitPlural: "cajas",
                        subtotal: 6
                    )
                ],
                total: 6
            )
        ],
        generalTotal: 6
    )
}
