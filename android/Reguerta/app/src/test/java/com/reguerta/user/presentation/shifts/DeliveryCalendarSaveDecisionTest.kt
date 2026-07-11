package com.reguerta.user.presentation.shifts

import com.reguerta.user.domain.calendar.DeliveryWeekday
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DeliveryCalendarSaveDecisionTest {
    @Test
    fun existingOverrideReturningToDefaultDeletesOverride() {
        assertTrue(
            shouldDeleteDeliveryCalendarOverride(
                hasExistingOverride = true,
                selectedWeekday = DeliveryWeekday.WEDNESDAY,
                defaultWeekday = DeliveryWeekday.WEDNESDAY,
            ),
        )
    }

    @Test
    fun differentDayOrMissingOverrideSavesOverride() {
        assertFalse(
            shouldDeleteDeliveryCalendarOverride(
                hasExistingOverride = true,
                selectedWeekday = DeliveryWeekday.FRIDAY,
                defaultWeekday = DeliveryWeekday.WEDNESDAY,
            ),
        )
        assertFalse(
            shouldDeleteDeliveryCalendarOverride(
                hasExistingOverride = false,
                selectedWeekday = DeliveryWeekday.WEDNESDAY,
                defaultWeekday = DeliveryWeekday.WEDNESDAY,
            ),
        )
    }
}
