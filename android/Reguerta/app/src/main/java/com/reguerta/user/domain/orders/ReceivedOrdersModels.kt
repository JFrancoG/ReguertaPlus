package com.reguerta.user.domain.orders

import java.util.Locale
import kotlin.math.abs

enum class ReceivedOrderProducerStatus(val wireValue: String) {
    UNREAD("unread"),
    READ("read"),
    PREPARED("prepared"),
    DELIVERED("delivered"),
    ;

    companion object {
        fun fromWireValue(rawValue: String?): ReceivedOrderProducerStatus {
            val normalized = rawValue?.trim()?.lowercase(Locale.ROOT)
            return entries.firstOrNull { status -> status.wireValue == normalized } ?: UNREAD
        }
    }
}

data class ReceivedOrderLineRecord(
    val id: String,
    val orderId: String,
    val consumerId: String,
    val consumerDisplayName: String,
    val productId: String,
    val productName: String,
    val productImageUrl: String?,
    val companyName: String,
    val packagingLine: String,
    val quantity: Double,
    val quantityUnitSingular: String,
    val quantityUnitPlural: String,
    val measureQuantityPerUnit: Double,
    val isWeightPricing: Boolean,
    val subtotal: Double,
) {
    val dedupKey: String
        get() = "$orderId|$consumerId|$productId"

    val orderedQuantity: Double
        get() = if (isWeightPricing && measureQuantityPerUnit > 0.0 && weightQuantityRepresentsMeasure) {
            quantity / measureQuantityPerUnit
        } else {
            quantity
        }

    private val weightQuantityRepresentsMeasure: Boolean
        get() {
            if (!isWeightPricing || measureQuantityPerUnit <= 0.0) return true
            return quantity >= measureQuantityPerUnit
        }
}

data class ReceivedOrdersProductRow(
    val productId: String,
    val productName: String,
    val productImageUrl: String?,
    val packagingLine: String,
    val totalQuantity: Double,
    val quantityUnitSingular: String,
    val quantityUnitPlural: String,
) {
    fun quantityUnitLabel(): String =
        if (receivedOrdersIsApproximatelyOne(totalQuantity)) quantityUnitSingular else quantityUnitPlural
}

data class ReceivedOrdersMemberLine(
    val id: String,
    val productName: String,
    val packagingLine: String,
    val quantity: Double,
    val quantityUnitSingular: String,
    val quantityUnitPlural: String,
    val subtotal: Double,
) {
    fun quantityUnitLabel(): String =
        if (receivedOrdersIsApproximatelyOne(quantity)) quantityUnitSingular else quantityUnitPlural
}

data class ReceivedOrdersMemberGroup(
    val id: String,
    val orderId: String,
    val consumerDisplayName: String,
    val producerStatus: ReceivedOrderProducerStatus,
    val lines: List<ReceivedOrdersMemberLine>,
    val total: Double,
)

data class ReceivedOrdersSnapshot(
    val byProductRows: List<ReceivedOrdersProductRow>,
    val byMemberGroups: List<ReceivedOrdersMemberGroup>,
    val generalTotal: Double,
) {
    fun withProducerStatus(
        orderId: String,
        status: ReceivedOrderProducerStatus,
    ): ReceivedOrdersSnapshot =
        copy(
            byMemberGroups = byMemberGroups.map { group ->
                if (group.orderId == orderId) {
                    group.copy(producerStatus = status)
                } else {
                    group
                }
            },
        )
}

enum class ReceivedOrderStatusWriteResult {
    SUCCESS,
    PERMISSION_DENIED,
    FAILURE,
}

fun Throwable.toReceivedOrderStatusWriteResult(): ReceivedOrderStatusWriteResult {
    val codeName = runCatching {
        javaClass.methods.firstOrNull { method -> method.name == "getCode" }
            ?.invoke(this)
            ?.toString()
            ?.uppercase()
    }.getOrNull()
    val normalizedMessage = message?.uppercase().orEmpty()

    return if (
        codeName?.contains("PERMISSION_DENIED") == true ||
        normalizedMessage.contains("PERMISSION_DENIED") ||
        normalizedMessage.contains("PERMISSION-DENIED")
    ) {
        ReceivedOrderStatusWriteResult.PERMISSION_DENIED
    } else {
        ReceivedOrderStatusWriteResult.FAILURE
    }
}

private fun receivedOrdersIsApproximatelyOne(value: Double): Boolean =
    abs(value - 1.0) < 0.0001
