package com.reguerta.user.data.shifts

import com.google.firebase.Timestamp
import com.reguerta.user.data.calendar.decodeDefaultDeliveryWeekday
import com.reguerta.user.data.calendar.decodeDefaultDeliveryWeekdayCandidates
import com.reguerta.user.data.calendar.decodeDeliveryCalendarOverrideDocuments
import com.reguerta.user.data.shiftswap.decodeShiftSwapRequestDocuments
import com.reguerta.user.domain.calendar.DeliveryWeekday
import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.fail
import org.junit.Test

class FirestoreShiftDataDecodingTest {
    @Test
    fun `successful empty queries remain empty`() {
        assertEquals(emptyList<Any>(), decodeShiftDocuments(emptyList()))
        assertEquals(emptyList<Any>(), decodeShiftSwapRequestDocuments(emptyList()))
        assertEquals(emptyList<Any>(), decodeDeliveryCalendarOverrideDocuments(emptyList()))
    }

    @Test
    fun `invalid shift document fails the complete snapshot`() {
        assertInvalidData {
            decodeShiftDocuments(
                listOf(
                    "shift-1" to mapOf(
                        "type" to "unexpected",
                        "status" to "planned",
                        "date" to Timestamp(1, 0),
                        "assignedUserIds" to listOf("member-1"),
                        "source" to "app",
                        "createdAt" to Timestamp(1, 0),
                        "updatedAt" to Timestamp(1, 0),
                    ),
                ),
            )
        }
    }

    @Test
    fun `shift documents require source and audit timestamps`() {
        val validDocument = mapOf<String, Any?>(
            "type" to "delivery",
            "status" to "planned",
            "date" to Timestamp(1, 0),
            "assignedUserIds" to listOf("member-1"),
            "source" to "app",
            "createdAt" to Timestamp(1, 0),
            "updatedAt" to Timestamp(1, 0),
        )

        listOf("source", "createdAt", "updatedAt").forEach { missingField ->
            assertInvalidData {
                decodeShiftDocuments(listOf("shift-1" to (validDocument - missingField)))
            }
        }
    }

    @Test
    fun `planner provenance stays additive while source remains app`() {
        val timestamp = Timestamp(1, 0)
        val plannerDocument = mapOf<String, Any?>(
            "planningSchemaVersion" to 1L,
            "type" to "delivery",
            "date" to timestamp,
            "assignedUserIds" to listOf("member-1"),
            "helperUserId" to "member-2",
            "status" to "planned",
            "source" to "app",
            "origin" to "planner",
            "planningRequestId" to "bundle-2026",
            "bundleRevision" to "bundle-v2-1234567890abcdef12345678",
            "bundleDigest" to "shift-planning:v1:sha256:${"a".repeat(64)}",
            "writeEpoch" to 8L,
            "projectionSeasonStartYear" to 2026L,
            "rotationOwnerUserId" to "member-1",
            "rotationOwnerUserIds" to null,
            "roundNumber" to 2L,
            "positionInRound" to 4L,
            "rotationPositions" to null,
            "planningReason" to "target",
            "assignmentRevision" to 1L,
            "completion" to mapOf(
                "state" to "uncompleted",
                "revision" to 0L,
                "actualHelperUserId" to null,
                "helperSourceAssignmentRevision" to null,
                "completedAt" to null,
            ),
            "documentRevision" to 1L,
            "lastBackendMutation" to mapOf("kind" to "activation"),
            "createdAt" to timestamp,
            "updatedAt" to timestamp,
        )

        val decoded = decodeShiftDocuments(listOf("shift-delivery-1" to plannerDocument)).single()

        assertEquals("shift-delivery-1", decoded.id)
        assertEquals("app", decoded.source)
        assertEquals(listOf("member-1"), decoded.assignedUserIds)
        assertEquals("member-2", decoded.helperUserId)
        assertInvalidData {
            decodeShiftDocuments(
                listOf("shift-delivery-1" to (plannerDocument + ("source" to "planner"))),
            )
        }
    }

    @Test
    fun `invalid nested swap candidate fails the complete snapshot`() {
        assertInvalidData {
            decodeShiftSwapRequestDocuments(
                listOf(
                    "request-1" to mapOf(
                        "requestedShiftId" to "shift-1",
                        "requesterUserId" to "member-1",
                        "reason" to "",
                        "status" to "open",
                        "requestedAt" to Timestamp(1, 0),
                        "candidates" to listOf(mapOf("userId" to "member-2")),
                        "responses" to emptyList<Map<String, Any?>>(),
                    ),
                ),
            )
        }
    }

    @Test
    fun `swap documents require reason candidates and responses`() {
        val validDocument = mapOf<String, Any?>(
            "requestedShiftId" to "shift-1",
            "requesterUserId" to "member-1",
            "reason" to "",
            "status" to "open",
            "requestedAt" to Timestamp(1, 0),
            "candidates" to emptyList<Map<String, Any?>>(),
            "responses" to emptyList<Map<String, Any?>>(),
        )

        listOf("reason", "candidates", "responses").forEach { missingField ->
            assertInvalidData {
                decodeShiftSwapRequestDocuments(listOf("request-1" to (validDocument - missingField)))
            }
        }
        assertEquals(1, decodeShiftSwapRequestDocuments(listOf("request-1" to validDocument)).size)
    }

    @Test
    fun `missing delivery configuration document allows fallback`() {
        assertNull(decodeDefaultDeliveryWeekday(documentExists = false, data = emptyMap()))
        assertEquals(
            DeliveryWeekday.WEDNESDAY,
            decodeDefaultDeliveryWeekdayCandidates(
                listOf(
                    false to emptyMap(),
                    true to mapOf("deliveryDayOfWeek" to "WED"),
                ),
            ),
        )
    }

    @Test
    fun `missing member and global delivery configuration is not found`() {
        assertRepositoryError(RepositoryErrorKind.NOT_FOUND) {
            decodeDefaultDeliveryWeekdayCandidates(
                listOf(
                    false to emptyMap(),
                    false to emptyMap(),
                ),
            )
        }
    }

    @Test
    fun `present invalid delivery configuration is not treated as absent`() {
        assertInvalidData {
            decodeDefaultDeliveryWeekday(
                documentExists = true,
                data = mapOf("deliveryDayOfWeek" to 3L),
            )
        }
        assertInvalidData {
            decodeDefaultDeliveryWeekday(documentExists = true, data = emptyMap())
        }
    }

    @Test
    fun `invalid delivery override fails the complete snapshot`() {
        assertInvalidData {
            decodeDeliveryCalendarOverrideDocuments(
                listOf("2026-W31" to mapOf("weekKey" to "2026-W31")),
            )
        }
    }

    @Test
    fun `delivery override requires its complete persisted schema`() {
        val validDocument = mapOf<String, Any?>(
            "weekKey" to "2026-W31",
            "deliveryDate" to Timestamp(1, 0),
            "ordersBlockedDate" to Timestamp(2, 0),
            "ordersOpenAt" to Timestamp(3, 0),
            "ordersCloseAt" to Timestamp(4, 0),
            "updatedBy" to "member-1",
            "updatedAt" to Timestamp(5, 0),
        )

        listOf(
            "weekKey",
            "deliveryDate",
            "ordersBlockedDate",
            "ordersOpenAt",
            "ordersCloseAt",
            "updatedBy",
            "updatedAt",
        ).forEach { missingField ->
            assertInvalidData {
                decodeDeliveryCalendarOverrideDocuments(
                    listOf("2026-W31" to (validDocument - missingField)),
                )
            }
        }
        assertInvalidData {
            decodeDeliveryCalendarOverrideDocuments(
                listOf("2026-W32" to validDocument),
            )
        }
    }

    private fun assertInvalidData(block: () -> Unit) {
        assertRepositoryError(RepositoryErrorKind.INVALID_DATA, block)
    }

    private fun assertRepositoryError(expectedKind: RepositoryErrorKind, block: () -> Unit) {
        try {
            block()
            fail("Expected RepositoryException")
        } catch (error: RepositoryException) {
            assertEquals(expectedKind, error.kind)
        }
    }
}
