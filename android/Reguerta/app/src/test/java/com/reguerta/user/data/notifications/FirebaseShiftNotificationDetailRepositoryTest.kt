package com.reguerta.user.data.notifications

import com.reguerta.user.domain.RepositoryException
import com.reguerta.user.domain.shifts.ShiftType
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.add
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class FirebaseShiftNotificationDetailRepositoryTest {
    @Test
    fun `decodes exact current detail and rejects stale or rich response shapes`() {
        val detail = decodeShiftNotificationDetail(
            value = response(),
            expectedEventId = "event-1",
            expectedMemberId = "member-1",
        )

        assertEquals("event-1", detail.eventId)
        assertEquals(2L, detail.assignmentRevision)
        assertEquals(ShiftType.DELIVERY, detail.shift.type)
        assertEquals(listOf("member-1"), detail.shift.assignedUserIds)

        assertThrows(RepositoryException::class.java) {
            decodeShiftNotificationDetail(response(extraField = true), "event-1", "member-1")
        }
        assertThrows(RepositoryException::class.java) {
            decodeShiftNotificationDetail(response(assignedUserId = "member-2"), "event-1", "member-1")
        }
    }

    private fun response(
        extraField: Boolean = false,
        assignedUserId: String = "member-1",
    ): JsonObject = buildJsonObject {
        put("schemaVersion", 1)
        put("eventId", "event-1")
        put("assignmentRevision", 2)
        put("documentRevision", 3)
        put("shift", buildJsonObject {
            put("id", "shift_delivery_20260902")
            put("type", "delivery")
            put("dateMillis", 1_788_307_200_000)
            put("assignedUserIds", buildJsonArray { add(assignedUserId) })
            put("helperUserId", "member-2")
            put("status", "planned")
            put("source", "app")
            put("createdAtMillis", 1_788_307_200_000)
            put("updatedAtMillis", 1_788_307_300_000)
        })
        if (extraField) put("memberName", "Ana")
    }
}
