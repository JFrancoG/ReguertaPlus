package com.reguerta.user.data.calendar

import com.reguerta.user.domain.calendar.DeliveryCalendarOverride
import com.reguerta.user.domain.calendar.DeliveryCalendarRepository
import com.reguerta.user.domain.calendar.DeliveryWeekday
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class InMemoryDeliveryCalendarRepository(
    private val defaultDeliveryDayOfWeek: DeliveryWeekday = DeliveryWeekday.WEDNESDAY,
) : DeliveryCalendarRepository {
    private val mutex = Mutex()
    private val overrides = linkedMapOf<String, DeliveryCalendarOverride>()

    override suspend fun getDefaultDeliveryDayOfWeek(): DeliveryWeekday = defaultDeliveryDayOfWeek

    override suspend fun getAllOverrides(): List<DeliveryCalendarOverride> = mutex.withLock {
        overrides.values.sortedBy { it.weekKey }
    }

    override suspend fun upsertOverride(override: DeliveryCalendarOverride): DeliveryCalendarOverride = mutex.withLock {
        overrides[override.weekKey] = override
        override
    }

    override suspend fun deleteOverride(weekKey: String) {
        mutex.withLock {
            overrides.remove(weekKey)
        }
    }
}
