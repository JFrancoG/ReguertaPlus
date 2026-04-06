package com.reguerta.user.data.calendar

import com.reguerta.user.domain.calendar.DeliveryCalendarOverride
import com.reguerta.user.domain.calendar.DeliveryCalendarRepository
import com.reguerta.user.domain.calendar.DeliveryWeekday

class ChainedDeliveryCalendarRepository(
    private val primary: DeliveryCalendarRepository,
    private val fallback: DeliveryCalendarRepository,
) : DeliveryCalendarRepository {
    override suspend fun getDefaultDeliveryDayOfWeek(): DeliveryWeekday? =
        primary.getDefaultDeliveryDayOfWeek() ?: fallback.getDefaultDeliveryDayOfWeek()

    override suspend fun getAllOverrides(): List<DeliveryCalendarOverride> {
        val primaryOverrides = primary.getAllOverrides()
        return if (primaryOverrides.isNotEmpty()) primaryOverrides else fallback.getAllOverrides()
    }

    override suspend fun upsertOverride(override: DeliveryCalendarOverride): DeliveryCalendarOverride {
        val persisted = primary.upsertOverride(override)
        fallback.upsertOverride(persisted)
        return persisted
    }

    override suspend fun deleteOverride(weekKey: String) {
        primary.deleteOverride(weekKey)
        fallback.deleteOverride(weekKey)
    }
}
