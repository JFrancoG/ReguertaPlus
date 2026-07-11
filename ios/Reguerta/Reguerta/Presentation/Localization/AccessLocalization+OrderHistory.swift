import Foundation

extension AccessL10nKey {
    static let orderHistoryWeek = "order_history.week"
    static let orderHistoryWeekShort = "order_history.week_short"
    static let orderHistoryOrder = "order_history.order"
    static let orderHistoryPreviousWeek = "order_history.previous_week"
    static let orderHistoryNextWeek = "order_history.next_week"
    static let orderHistorySelect = "order_history.select"
    static let orderHistoryEmpty = "order_history.empty"
    static let orderHistoryError = "order_history.error"
    static let orderHistoryRetry = "order_history.retry"
    static let orderHistoryProducerTotalFormat = "order_history.producer_total_format"
    static let orderHistoryOrderTotalFormat = "order_history.order_total_format"
    static let orderHistoryQuantitySingle = "order_history.quantity_single"
    static let orderHistoryQuantityPluralFormat = "order_history.quantity_plural_format"

    static let receivedOrdersHistoryTitle = "received_orders.history.title"
    static let receivedOrdersTabsTitle = "received_orders.tabs.title"
    static let receivedOrdersTabByProduct = "received_orders.tab.by_product"
    static let receivedOrdersTabByMember = "received_orders.tab.by_member"
    static let receivedOrdersProducerOnlyTitle = "received_orders.producer_only.title"
    static let receivedOrdersProducerOnlyBody = "received_orders.producer_only.body"
    static let receivedOrdersHistoryEmpty = "received_orders.history.empty"
    static let receivedOrdersErrorTitle = "received_orders.error.title"
    static let receivedOrdersErrorBody = "received_orders.error.body"
    static let receivedOrdersRetry = "received_orders.retry"
    static let receivedOrdersStatusSaving = "received_orders.status.saving"
    static let receivedOrdersStatusPending = "received_orders.status.pending"
    static let receivedOrdersStatusPrepared = "received_orders.status.prepared"
    static let receivedOrdersStatusDelivered = "received_orders.status.delivered"
    static let receivedOrdersStatusFormat = "received_orders.status.format"
    static let receivedOrdersMemberTotalFormat = "received_orders.member_total_format"
    static let receivedOrdersGeneralTotalFormat = "received_orders.general_total_format"
}

func localizedReceivedOrdersTabTitle(_ tab: ReceivedOrdersTab) -> String {
    switch tab {
    case .byProduct:
        l10n(AccessL10nKey.receivedOrdersTabByProduct)
    case .byMember:
        l10n(AccessL10nKey.receivedOrdersTabByMember)
    }
}

func localizedProducerOrderStatusTitle(_ status: ProducerOrderStatus) -> String {
    switch status {
    case .unread, .read:
        l10n(AccessL10nKey.receivedOrdersStatusPending)
    case .prepared:
        l10n(AccessL10nKey.receivedOrdersStatusPrepared)
    case .delivered:
        l10n(AccessL10nKey.receivedOrdersStatusDelivered)
    }
}
