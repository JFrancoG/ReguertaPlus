package com.reguerta.user.presentation.orders

import com.reguerta.user.domain.calendar.DeliveryCalendarOverride
import com.reguerta.user.domain.calendar.DeliveryWeekday
import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.domain.shifts.ShiftStatus
import com.reguerta.user.domain.shifts.ShiftType
import java.time.LocalDate
import java.time.ZoneId
import org.junit.Assert.assertEquals
import org.junit.Test

class ReceivedOrdersWindowTest {
    private val zone = ZoneId.of("Europe/Madrid")

    @Test
    fun window_usesWednesdayWhenNoDeliveryCalendarOverrideEvenIfShiftIsLater() {
        val window = resolveReceivedOrdersWindow(
            nowMillis = LocalDate.of(2026, 7, 9).toMillis(),
            defaultDeliveryDayOfWeek = DeliveryWeekday.WEDNESDAY,
            deliveryCalendarOverrides = emptyList(),
            shifts = listOf(deliveryShift("delivery_2026w28", LocalDate.of(2026, 7, 9))),
        )

        assertEquals(false, window.isEnabled)
        assertEquals("2026-W28", window.targetWeekKey)
    }

    @Test
    fun window_usesDeliveryCalendarOverrideWhenPresent() {
        val window = resolveReceivedOrdersWindow(
            nowMillis = LocalDate.of(2026, 7, 9).toMillis(),
            defaultDeliveryDayOfWeek = DeliveryWeekday.WEDNESDAY,
            deliveryCalendarOverrides = listOf(
                deliveryOverride(
                    weekKey = "2026-W28",
                    deliveryDate = LocalDate.of(2026, 7, 9),
                ),
            ),
            shifts = listOf(deliveryShift("delivery_2026w28", LocalDate.of(2026, 7, 9))),
        )

        assertEquals(true, window.isEnabled)
        assertEquals("2026-W27", window.targetWeekKey)
    }

    private fun deliveryShift(id: String, date: LocalDate): ShiftAssignment =
        ShiftAssignment(
            id = id,
            type = ShiftType.DELIVERY,
            dateMillis = date.toMillis(),
            assignedUserIds = listOf("member_1"),
            helperUserId = "member_2",
            status = ShiftStatus.CONFIRMED,
            source = "test",
            createdAtMillis = 0,
            updatedAtMillis = 0,
        )

    private fun deliveryOverride(
        weekKey: String,
        deliveryDate: LocalDate,
    ): DeliveryCalendarOverride {
        val deliveryMillis = deliveryDate.toMillis()
        return DeliveryCalendarOverride(
            weekKey = weekKey,
            deliveryDateMillis = deliveryMillis,
            ordersBlockedDateMillis = deliveryMillis,
            ordersOpenAtMillis = deliveryMillis,
            ordersCloseAtMillis = deliveryMillis,
            updatedBy = "test",
            updatedAtMillis = 0,
        )
    }

    private fun LocalDate.toMillis(): Long =
        atStartOfDay(zone).toInstant().toEpochMilli()
}
