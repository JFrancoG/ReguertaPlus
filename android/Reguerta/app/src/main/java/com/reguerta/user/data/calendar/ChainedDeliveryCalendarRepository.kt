package com.reguerta.user.data.calendar

import com.reguerta.user.domain.calendar.DeliveryCalendarOverride
import com.reguerta.user.domain.calendar.DeliveryCalendarRepository
import com.reguerta.user.domain.calendar.DeliveryWeekday

class ChainedDeliveryCalendarRepository(
    private val primary: DeliveryCalendarRepository,
    @Suppress("UNUSED_PARAMETER") fallback: DeliveryCalendarRepository,
) : DeliveryCalendarRepository {
    override suspend fun getDefaultDeliveryDayOfWeek(): DeliveryWeekday? =
        primary.getDefaultDeliveryDayOfWeek()

    override suspend fun getAllOverrides(): List<DeliveryCalendarOverride> = primary.getAllOverrides()

    override suspend fun upsertOverride(override: DeliveryCalendarOverride): DeliveryCalendarOverride =
        primary.upsertOverride(override)

    override suspend fun deleteOverride(weekKey: String) = primary.deleteOverride(weekKey)
}
