package com.reguerta.user.domain.orders

data class OrderSummaryLine(
    val id: String,
    val vendorId: String,
    val companyName: String,
    val productName: String,
    val packagingLine: String,
    val quantityLabel: String,
    val subtotal: Double,
)

data class OrderSummaryGroup(
    val vendorId: String,
    val companyName: String,
    val lines: List<OrderSummaryLine>,
    val subtotal: Double,
)

data class OrderSummarySnapshot(
    val weekKey: String,
    val groups: List<OrderSummaryGroup>,
    val total: Double,
)

interface OrdersRepository {
    suspend fun orderHistoryWeekKeys(currentMemberId: String?): List<String>
    suspend fun orderSummarySnapshot(currentMemberId: String?, weekKey: String): OrderSummarySnapshot?
}
