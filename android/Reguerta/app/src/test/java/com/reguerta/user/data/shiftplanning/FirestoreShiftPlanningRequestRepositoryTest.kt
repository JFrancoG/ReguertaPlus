package com.reguerta.user.data.shiftplanning

import com.google.firebase.Timestamp
import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import com.reguerta.user.domain.shifts.ShiftPlanningRequest
import com.reguerta.user.domain.shifts.ShiftPlanningRequestStatus
import com.reguerta.user.domain.shifts.ShiftPlanningRequestType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class FirestoreShiftPlanningRequestRepositoryTest {
    @Test
    fun `absent request creates the stable intent`() {
        val resolution = resolveShiftPlanningPersistence(
            documentExists = false,
            data = emptyMap(),
            expected = request(),
        )

        assertEquals(ShiftPlanningPersistenceResolution.Create, resolution)
    }

    @Test
    fun `existing compatible request acknowledges every valid backend status without create`() {
        val expected = request()
        val statuses = mapOf(
            "requested" to ShiftPlanningRequestStatus.REQUESTED,
            "processing" to ShiftPlanningRequestStatus.PROCESSING,
            "completed" to ShiftPlanningRequestStatus.COMPLETED,
            "failed" to ShiftPlanningRequestStatus.FAILED,
        )

        statuses.forEach { (wireStatus, expectedStatus) ->
            val resolution = resolveShiftPlanningPersistence(
                documentExists = true,
                data = persistedData(status = wireStatus),
                expected = expected,
            )

            assertTrue(resolution is ShiftPlanningPersistenceResolution.AcknowledgeExisting)
            assertEquals(
                expectedStatus,
                (resolution as ShiftPlanningPersistenceResolution.AcknowledgeExisting).request.status,
            )
        }
    }

    @Test
    fun `existing incompatible intent is invalid data`() {
        val mismatches = listOf(
            persistedData(type = "market"),
            persistedData(requestedByUserId = "member-2"),
            persistedData(requestedAt = Timestamp(2, 0)),
        )

        mismatches.forEach { data ->
            assertInvalidData {
                resolveShiftPlanningPersistence(
                    documentExists = true,
                    data = data,
                    expected = request(),
                )
            }
        }
    }

    @Test
    fun `existing malformed request is invalid data`() {
        val valid = persistedData()
        listOf("type", "requestedByUserId", "requestedAt", "status").forEach { missingField ->
            assertInvalidData {
                resolveShiftPlanningPersistence(
                    documentExists = true,
                    data = valid - missingField,
                    expected = request(),
                )
            }
        }
        assertInvalidData {
            resolveShiftPlanningPersistence(
                documentExists = true,
                data = persistedData(status = "unexpected"),
                expected = request(),
            )
        }
    }

    @Test
    fun `new intent requires requested status`() {
        listOf(
            ShiftPlanningRequestStatus.PROCESSING,
            ShiftPlanningRequestStatus.COMPLETED,
            ShiftPlanningRequestStatus.FAILED,
        ).forEach { invalidInitialStatus ->
            assertInvalidData {
                resolveShiftPlanningPersistence(
                    documentExists = false,
                    data = emptyMap(),
                    expected = request().copy(status = invalidInitialStatus),
                )
            }
        }
    }

    private fun request() = ShiftPlanningRequest(
        id = "planning-1",
        type = ShiftPlanningRequestType.DELIVERY,
        requestedByUserId = "member-1",
        requestedAtMillis = 1_000L,
        status = ShiftPlanningRequestStatus.REQUESTED,
    )

    private fun persistedData(
        type: String = "delivery",
        requestedByUserId: String = "member-1",
        requestedAt: Timestamp = Timestamp(1, 0),
        status: String = "requested",
    ): Map<String, Any?> = mapOf(
        "type" to type,
        "requestedByUserId" to requestedByUserId,
        "requestedAt" to requestedAt,
        "status" to status,
    )

    private fun assertInvalidData(block: () -> Unit) {
        try {
            block()
            fail("Expected RepositoryException")
        } catch (error: RepositoryException) {
            assertEquals(RepositoryErrorKind.INVALID_DATA, error.kind)
        }
    }
}
