package com.reguerta.user.domain.notifications

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ShiftNotificationPushReferenceTest {
    @Test
    fun canonicalGenericReferenceIsAccepted() {
        assertEquals(
            "bundle-v2-1234567890abcdef12345678-notification-1",
            ShiftNotificationPushReference.validated(
                eventId = "bundle-v2-1234567890abcdef12345678-notification-1",
                type = "shift_updated",
                target = "users",
            )?.eventId,
        )
    }

    @Test
    fun malformedOrNonGenericReferencesAreRejected() {
        listOf(
            Triple("", "shift_updated", "users"),
            Triple("event/1", "shift_updated", "users"),
            Triple("event-1", "admin_broadcast", "users"),
            Triple("event-1", "shift_updated", "all"),
        ).forEach { (eventId, type, target) ->
            assertNull(ShiftNotificationPushReference.validated(eventId, type, target))
        }
    }
}
