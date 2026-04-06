package com.reguerta.user.domain.calendar

enum class DeliveryWeekday(val wireValue: String) {
    MONDAY("MON"),
    TUESDAY("TUE"),
    WEDNESDAY("WED"),
    THURSDAY("THU"),
    FRIDAY("FRI"),
    SATURDAY("SAT"),
    SUNDAY("SUN");

    companion object {
        fun fromWireValue(raw: String?): DeliveryWeekday? =
            entries.firstOrNull { it.wireValue == raw?.trim()?.uppercase() }
    }
}

data class DeliveryCalendarOverride(
    val weekKey: String,
    val deliveryDateMillis: Long,
    val ordersBlockedDateMillis: Long,
    val ordersOpenAtMillis: Long,
    val ordersCloseAtMillis: Long,
    val updatedBy: String,
    val updatedAtMillis: Long,
)
