package com.reguerta.user.domain.calendar

interface DeliveryCalendarDefaultDayReader {
    suspend fun getDefaultDeliveryDayOfWeek(): DeliveryWeekday?
}

interface DeliveryCalendarRepository : DeliveryCalendarDefaultDayReader {
    suspend fun getAllOverrides(): List<DeliveryCalendarOverride>
    suspend fun upsertOverride(override: DeliveryCalendarOverride): DeliveryCalendarOverride
    suspend fun deleteOverride(weekKey: String)
}
