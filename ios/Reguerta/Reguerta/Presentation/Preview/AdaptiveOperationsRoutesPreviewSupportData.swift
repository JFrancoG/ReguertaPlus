#if DEBUG
import Foundation

enum AdaptiveOperationsPreviewData {
    static let timeZone: TimeZone = {
        guard let timeZone = TimeZone(identifier: "Europe/Madrid") else {
            preconditionFailure("Operations previews require the Europe/Madrid time zone")
        }
        return timeZone
    }()

    static let nowMillis = operationsPreviewMillis(month: 8, day: 20, hour: 12)
    static let receivedOrdersNowMillis = operationsPreviewMillis(month: 8, day: 17, hour: 12)

    static let currentMember = Member(
        id: "operations-admin-producer",
        displayName: "Alejandra Administración Comunitaria",
        companyName: "Huerta Regüerta",
        phoneNumber: "+34 600 100 001",
        normalizedEmail: "alejandra.operations@example.test",
        authUid: "operations-preview-auth",
        roles: [.member, .producer, .admin],
        isActive: true,
        producerCatalogEnabled: true,
        isCommonPurchaseManager: true,
        producerParity: .even
    )

    static let producer = Member(
        id: "operations-producer",
        displayName: "María de los Ángeles Fernández",
        companyName: "Huerta comunitaria La Acequia",
        phoneNumber: "+34 600 100 002",
        normalizedEmail: "maria.operations@example.test",
        authUid: "operations-producer-auth",
        roles: [.member, .producer],
        isActive: true,
        producerCatalogEnabled: true,
        producerParity: .odd
    )

    static let consumer = Member(
        id: "operations-consumer",
        displayName: "Familia Rodríguez de la Fuente",
        normalizedEmail: "familia.operations@example.test",
        authUid: "operations-consumer-auth",
        roles: [.member],
        isActive: true,
        producerCatalogEnabled: false
    )

    static let helper = Member(
        id: "operations-helper",
        displayName: "Guillermo de la Cooperativa del Barrio",
        normalizedEmail: "guillermo.operations@example.test",
        authUid: "operations-helper-auth",
        roles: [.member],
        isActive: true,
        producerCatalogEnabled: false
    )

    static let members = [currentMember, producer, consumer, helper]

    static let session = AuthorizedSession(
        principal: AuthPrincipal(uid: "operations-preview-auth", email: currentMember.normalizedEmail),
        authenticatedMember: currentMember,
        member: currentMember,
        members: members,
        environment: .develop
    )

    static let sharedProfile = SharedProfile(
        userId: currentMember.id,
        familyNames: "Alejandra, Marcos y sus dos peques",
        photoUrl: nil,
        about: "Organizamos los turnos, las entregas y la acogida de nuevas familias de la comunidad.",
        updatedAtMillis: nowMillis
    )

    static let products = [vegetableBasket, oliveOil, communityBread]

    static let vegetableBasket = Product(
        id: "operations-product-basket",
        vendorId: producer.id,
        companyName: producer.companyName ?? "Huerta comunitaria",
        name: "Cesta grande de verduras ecológicas de temporada",
        description: "Tomate, calabacín, berenjena y otras variedades según la cosecha semanal.",
        productImageUrl: nil,
        price: 18.50,
        pricingMode: .fixed,
        unitName: "cesta",
        unitAbbreviation: "ud",
        unitPlural: "cestas",
        unitQty: 1,
        packContainerName: nil,
        packContainerAbbreviation: nil,
        packContainerPlural: nil,
        packContainerQty: nil,
        isAvailable: true,
        stockMode: .finite,
        stockQty: 12,
        isEcoBasket: true,
        isCommonPurchase: false,
        commonPurchaseType: nil,
        archived: false,
        createdAtMillis: operationsPreviewMillis(month: 8, day: 1, hour: 9),
        updatedAtMillis: nowMillis
    )

    static let oliveOil = Product(
        id: "operations-product-oil",
        vendorId: producer.id,
        companyName: producer.companyName ?? "Huerta comunitaria",
        name: "Aceite de oliva virgen extra de cosecha temprana",
        description: "Botella retornable preparada por la cooperativa local.",
        productImageUrl: nil,
        price: 12.80,
        pricingMode: .fixed,
        unitName: "botella",
        unitAbbreviation: "ud",
        unitPlural: "botellas",
        unitQty: 1,
        packContainerName: "caja",
        packContainerAbbreviation: "caja",
        packContainerPlural: "cajas",
        packContainerQty: 6,
        isAvailable: true,
        stockMode: .infinite,
        stockQty: nil,
        isEcoBasket: false,
        isCommonPurchase: false,
        commonPurchaseType: nil,
        archived: false,
        createdAtMillis: operationsPreviewMillis(month: 8, day: 2, hour: 9),
        updatedAtMillis: nowMillis
    )

    static let communityBread = Product(
        id: "operations-product-bread",
        vendorId: myOrderCommonPurchasesGroupId,
        companyName: "Compras comunes Regüerta",
        name: "Hogaza integral artesana de masa madre",
        description: "Pedido conjunto semanal al obrador del barrio.",
        productImageUrl: nil,
        price: 5.40,
        pricingMode: .fixed,
        unitName: "hogaza",
        unitAbbreviation: "ud",
        unitPlural: "hogazas",
        unitQty: 1,
        packContainerName: nil,
        packContainerAbbreviation: nil,
        packContainerPlural: nil,
        packContainerQty: nil,
        isAvailable: true,
        stockMode: .infinite,
        stockQty: nil,
        isEcoBasket: false,
        isCommonPurchase: true,
        commonPurchaseType: .spot,
        archived: false,
        createdAtMillis: operationsPreviewMillis(month: 8, day: 3, hour: 9),
        updatedAtMillis: nowMillis
    )

    static let cartSnapshot = MyOrderCartSnapshot(
        selectedQuantities: [
            vegetableBasket.id: 2,
            oliveOil.id: 1,
            communityBread.id: 3
        ],
        selectedEcoBasketOptions: [vegetableBasket.id: ecoBasketOptionPickup]
    )

    static let shifts = [pastDeliveryShift, nextMarketShift, nextDeliveryShift, laterDeliveryShift]

    static let pastDeliveryShift = shift(
        id: "operations-shift-delivery-current-week",
        type: .delivery,
        dateMillis: operationsPreviewMillis(month: 8, day: 19, hour: 18),
        assignedUserIds: [producer.id],
        helperUserId: currentMember.id
    )

    static let nextMarketShift = shift(
        id: "operations-shift-market",
        type: .market,
        dateMillis: operationsPreviewMillis(month: 8, day: 22, hour: 9),
        assignedUserIds: [currentMember.id, helper.id],
        helperUserId: nil
    )

    static let nextDeliveryShift = shift(
        id: "operations-shift-delivery-next-week",
        type: .delivery,
        dateMillis: operationsPreviewMillis(month: 8, day: 26, hour: 18),
        assignedUserIds: [currentMember.id],
        helperUserId: helper.id
    )

    static let laterDeliveryShift = shift(
        id: "operations-shift-delivery-later-week",
        type: .delivery,
        dateMillis: operationsPreviewMillis(month: 9, day: 2, hour: 18),
        assignedUserIds: [producer.id],
        helperUserId: consumer.id
    )

    static let deliveryCalendarOverrides = [currentWeekOverride, nextWeekOverride, laterWeekOverride]

    static let currentWeekOverride = deliveryOverride(
        weekKey: "2026-W34",
        deliveryDay: 19,
        updatedAtMillis: operationsPreviewMillis(month: 8, day: 10, hour: 10)
    )

    static let nextWeekOverride = deliveryOverride(
        weekKey: "2026-W35",
        deliveryDay: 27,
        updatedAtMillis: operationsPreviewMillis(month: 8, day: 18, hour: 10)
    )

    static let laterWeekOverride = deliveryOverride(
        weekKey: "2026-W36",
        deliveryDay: 2,
        month: 9,
        updatedAtMillis: operationsPreviewMillis(month: 8, day: 18, hour: 10)
    )

    static let homeWeeklySummary = HomeWeeklySummaryDisplay(
        weekKey: "2026-W34",
        orderWeekKey: "2026-W34",
        weekRangeLabel: "17–23 agosto",
        weekRangeAccessibilityLabel: "Del 17 al 23 de agosto",
        weekBadgeLabel: "Semana 34",
        producerName: "Huerta comunitaria La Acequia",
        deliveryLabel: "Miércoles 19 de agosto · 18:00",
        responsibleName: currentMember.displayName,
        helperName: helper.displayName,
        marketLabel: "Sábado 22 de agosto · 09:00",
        marketResponsibleNames: [currentMember.displayName, helper.displayName],
        orderState: .unconfirmed,
        isConsultaPhase: false
    )

    static let latestNews = [
        NewsArticle(
            id: "operations-news",
            title: "Cambios importantes en el calendario de entregas comunitarias",
            body: "Consulta los horarios y la nueva organización de los turnos de apoyo.",
            active: true,
            publishedBy: currentMember.displayName,
            publishedAtMillis: nowMillis,
            urlImage: nil
        ),
        NewsArticle(
            id: "operations-news-reminder",
            title: "Recordatorio de cierre del pedido semanal",
            body: "Revisa las cantidades antes del cierre para que el productor reciba el pedido completo.",
            active: true,
            publishedBy: helper.displayName,
            publishedAtMillis: nowMillis - 60_000,
            urlImage: nil
        ),
        NewsArticle(
            id: "operations-news-market",
            title: "Próximo turno de mercado comunitario",
            body: "La información de responsables y horario ya está disponible en el resumen semanal.",
            active: true,
            publishedBy: currentMember.displayName,
            publishedAtMillis: nowMillis - 120_000,
            urlImage: nil
        )
    ]

    private static func shift(
        id: String,
        type: ShiftType,
        dateMillis: Int64,
        assignedUserIds: [String],
        helperUserId: String?
    ) -> ShiftAssignment {
        ShiftAssignment(
            id: id,
            type: type,
            dateMillis: dateMillis,
            assignedUserIds: assignedUserIds,
            helperUserId: helperUserId,
            status: .planned,
            source: "operations-preview",
            createdAtMillis: nowMillis,
            updatedAtMillis: nowMillis
        )
    }

    private static func deliveryOverride(
        weekKey: String,
        deliveryDay: Int,
        month: Int = 8,
        updatedAtMillis: Int64
    ) -> DeliveryCalendarOverride {
        DeliveryCalendarOverride(
            weekKey: weekKey,
            deliveryDateMillis: operationsPreviewMillis(month: month, day: deliveryDay, hour: 18),
            ordersBlockedDateMillis: operationsPreviewMillis(month: month, day: deliveryDay, hour: 12),
            ordersOpenAtMillis: operationsPreviewMillis(month: month, day: max(1, deliveryDay - 7), hour: 18),
            ordersCloseAtMillis: operationsPreviewMillis(month: month, day: max(1, deliveryDay - 1), hour: 20),
            updatedBy: currentMember.id,
            updatedAtMillis: updatedAtMillis
        )
    }
}

enum AdaptiveOperationsPreviewOrderData {
    static let personalHistory = MyOrderPreviousOrderSnapshot(
        weekKey: "2026-W33",
        groups: [
            MyOrderPreviousOrderGroup(
                vendorId: AdaptiveOperationsPreviewData.producer.id,
                companyName: AdaptiveOperationsPreviewData.producer.companyName ?? "Huerta comunitaria",
                lines: [
                    MyOrderPreviousOrderLine(
                        vendorId: AdaptiveOperationsPreviewData.producer.id,
                        companyName: AdaptiveOperationsPreviewData.producer.companyName ?? "Huerta comunitaria",
                        productName: "Cesta grande de verduras ecológicas de temporada",
                        packagingLine: "1 cesta por unidad",
                        quantityLabel: "2",
                        subtotal: 37
                    ),
                    MyOrderPreviousOrderLine(
                        vendorId: AdaptiveOperationsPreviewData.producer.id,
                        companyName: AdaptiveOperationsPreviewData.producer.companyName ?? "Huerta comunitaria",
                        productName: "Aceite de oliva virgen extra de cosecha temprana",
                        packagingLine: "1 botella por unidad",
                        quantityLabel: "1",
                        subtotal: 12.80
                    )
                ],
                subtotal: 49.80
            ),
            MyOrderPreviousOrderGroup(
                vendorId: myOrderCommonPurchasesGroupId,
                companyName: "Compras comunes Regüerta",
                lines: [
                    MyOrderPreviousOrderLine(
                        vendorId: myOrderCommonPurchasesGroupId,
                        companyName: "Compras comunes Regüerta",
                        productName: "Hogaza integral artesana de masa madre",
                        packagingLine: "1 hogaza por unidad",
                        quantityLabel: "3",
                        subtotal: 16.20
                    )
                ],
                subtotal: 16.20
            )
        ],
        total: 66
    )

    static let receivedOrders = ReceivedOrdersSnapshot(
        byProductRows: [vegetableProductRow, oilProductRow],
        byMemberGroups: [familyOrder, helperOrder],
        generalTotal: 81.30
    )

    private static let vegetableProductRow = ReceivedOrdersProductRow(
        productId: AdaptiveOperationsPreviewData.vegetableBasket.id,
        productName: AdaptiveOperationsPreviewData.vegetableBasket.name,
        productImageUrl: nil,
        companyName: AdaptiveOperationsPreviewData.currentMember.companyName ?? "Huerta Regüerta",
        packagingLine: "1 cesta por unidad",
        totalQuantity: 3,
        quantityUnitSingular: "cesta",
        quantityUnitPlural: "cestas",
        totalMeasureQuantity: 3,
        measureUnitSingular: "cesta",
        measureUnitPlural: "cestas",
        measureUnitAbbreviation: "ud",
        subtotal: 55.50
    )

    private static let oilProductRow = ReceivedOrdersProductRow(
        productId: AdaptiveOperationsPreviewData.oliveOil.id,
        productName: AdaptiveOperationsPreviewData.oliveOil.name,
        productImageUrl: nil,
        companyName: AdaptiveOperationsPreviewData.currentMember.companyName ?? "Huerta Regüerta",
        packagingLine: "1 botella por unidad",
        totalQuantity: 2,
        quantityUnitSingular: "botella",
        quantityUnitPlural: "botellas",
        totalMeasureQuantity: 2,
        measureUnitSingular: "botella",
        measureUnitPlural: "botellas",
        measureUnitAbbreviation: "ud",
        subtotal: 25.80
    )

    private static let familyOrder = ReceivedOrdersMemberGroup(
        id: "operations-order-family",
        orderId: "operations-order-family",
        consumerDisplayName: AdaptiveOperationsPreviewData.consumer.displayName,
        producerStatus: .unread,
        lines: [
            ReceivedOrdersMemberLine(
                id: "operations-family-basket",
                productName: AdaptiveOperationsPreviewData.vegetableBasket.name,
                packagingLine: "1 cesta por unidad",
                quantity: 2,
                quantityUnitSingular: "cesta",
                quantityUnitPlural: "cestas",
                totalMeasureQuantity: 2,
                measureUnitSingular: "cesta",
                measureUnitPlural: "cestas",
                measureUnitAbbreviation: "ud",
                subtotal: 37
            ),
            ReceivedOrdersMemberLine(
                id: "operations-family-oil",
                productName: AdaptiveOperationsPreviewData.oliveOil.name,
                packagingLine: "1 botella por unidad",
                quantity: 1,
                quantityUnitSingular: "botella",
                quantityUnitPlural: "botellas",
                totalMeasureQuantity: 1,
                measureUnitSingular: "botella",
                measureUnitPlural: "botellas",
                measureUnitAbbreviation: "ud",
                subtotal: 12.80
            )
        ],
        total: 49.80
    )

    private static let helperOrder = ReceivedOrdersMemberGroup(
        id: "operations-order-helper",
        orderId: "operations-order-helper",
        consumerDisplayName: AdaptiveOperationsPreviewData.helper.displayName,
        producerStatus: .prepared,
        lines: [
            ReceivedOrdersMemberLine(
                id: "operations-helper-basket",
                productName: AdaptiveOperationsPreviewData.vegetableBasket.name,
                packagingLine: "1 cesta por unidad",
                quantity: 1,
                quantityUnitSingular: "cesta",
                quantityUnitPlural: "cestas",
                totalMeasureQuantity: 1,
                measureUnitSingular: "cesta",
                measureUnitPlural: "cestas",
                measureUnitAbbreviation: "ud",
                subtotal: 18.50
            ),
            ReceivedOrdersMemberLine(
                id: "operations-helper-oil",
                productName: AdaptiveOperationsPreviewData.oliveOil.name,
                packagingLine: "1 botella por unidad",
                quantity: 1,
                quantityUnitSingular: "botella",
                quantityUnitPlural: "botellas",
                totalMeasureQuantity: 1,
                measureUnitSingular: "botella",
                measureUnitPlural: "botellas",
                measureUnitAbbreviation: "ud",
                subtotal: 12.80
            )
        ],
        total: 31.30
    )
}

private func operationsPreviewMillis(month: Int, day: Int, hour: Int) -> Int64 {
    var calendar = Calendar(identifier: .iso8601)
    calendar.timeZone = AdaptiveOperationsPreviewData.timeZone
    guard let date = calendar.date(
        from: DateComponents(
            calendar: calendar,
            timeZone: calendar.timeZone,
            year: 2026,
            month: month,
            day: day,
            hour: hour
        )
    ) else {
        preconditionFailure("Invalid operations preview date")
    }
    return Int64(date.timeIntervalSince1970 * 1_000)
}
#endif
