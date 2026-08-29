package com.reguerta.user.data.shiftplanning

import com.google.firebase.Timestamp
import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import com.reguerta.user.domain.shifts.ShiftPlanningRequest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class FirestoreShiftPlanningRequestRepositoryTest {
    @Test
    fun `absent request creates one exact combined preview payload`() {
        val request = request()
        val resolved = resolveShiftPlanningRequest(
            request = request,
            context = ShiftPlanningRequestContext(
                environment = "production",
                expectedWriteEpoch = 7,
                expectedActiveRevision = "active-6",
            ),
        )

        assertEquals(
            ShiftPlanningPersistenceResolution.Create,
            resolveShiftPlanningPersistence(
                documentExists = false,
                documentId = request.id,
                data = emptyMap(),
                expected = resolved,
            ),
        )
        assertEquals(
            setOf(
                "schemaVersion",
                "requestId",
                "bundleId",
                "environment",
                "requestedByUserId",
                "requestedAt",
                "mode",
                "status",
                "expectedWriteEpoch",
                "expectedActiveRevision",
                "subplans",
                "binding",
            ),
            resolved.firestorePayload().keys,
        )
        assertEquals(
            mapOf(
                "delivery" to mapOf("targetSeasonStartYear" to 2026),
                "market" to mapOf("targetSeasonStartYear" to 2027),
            ),
            resolved.firestorePayload()["subplans"],
        )
    }

    @Test
    fun `existing compatible request acknowledges every backend status without rewriting`() {
        val resolved = resolvedRequest()
        listOf("requested", "processing", "completed", "failed").forEach { status ->
            val resolution = resolveShiftPlanningPersistence(
                documentExists = true,
                documentId = resolved.request.id,
                data = persistedData(status = status),
                expected = resolved,
            )

            assertEquals(ShiftPlanningPersistenceResolution.AcknowledgeExisting, resolution)
        }
    }

    @Test
    fun `existing incompatible v2 intent is invalid data`() {
        val resolved = resolvedRequest()
        val mismatches = listOf(
            persistedData(bundleId = "bundle-2"),
            persistedData(environment = "develop"),
            persistedData(deliverySeason = 2025),
            persistedData(marketSeason = 2026),
            persistedData(requestedByUserId = "member-2"),
            persistedData(requestedAt = Timestamp(2, 0)),
        )

        mismatches.forEach { data ->
            assertInvalidData {
                resolveShiftPlanningPersistence(
                    documentExists = true,
                    documentId = resolved.request.id,
                    data = data,
                    expected = resolved,
                )
            }
        }
    }

    @Test
    fun `invalid explicit preview intent fails before persistence`() {
        for (invalid in listOf(
            request().copy(id = " "),
            request().copy(bundleId = " "),
            request().copy(deliveryTargetSeasonStartYear = 1999),
            request().copy(marketTargetSeasonStartYear = 9999),
        )) {
            assertInvalidData {
                resolveShiftPlanningRequest(
                    request = invalid,
                    context = ShiftPlanningRequestContext(
                        environment = "production",
                        expectedWriteEpoch = 7,
                        expectedActiveRevision = null,
                    ),
                )
            }
        }
    }

    private fun request() = ShiftPlanningRequest(
        id = "planning-1",
        bundleId = "bundle-1",
        requestedByUserId = "member-1",
        requestedAtMillis = 1_000L,
        deliveryTargetSeasonStartYear = 2026,
        marketTargetSeasonStartYear = 2027,
    )

    private fun resolvedRequest() = resolveShiftPlanningRequest(
        request = request(),
        context = ShiftPlanningRequestContext(
            environment = "production",
            expectedWriteEpoch = 7,
            expectedActiveRevision = "active-6",
        ),
    )

    private fun persistedData(
        bundleId: String = "bundle-1",
        environment: String = "production",
        deliverySeason: Int = 2026,
        marketSeason: Int = 2027,
        requestedByUserId: String = "member-1",
        requestedAt: Timestamp = Timestamp(1, 0),
        status: String = "requested",
    ): Map<String, Any?> = mapOf(
        "schemaVersion" to 2,
        "requestId" to "planning-1",
        "bundleId" to bundleId,
        "environment" to environment,
        "requestedByUserId" to requestedByUserId,
        "requestedAt" to requestedAt,
        "mode" to "preview",
        "status" to status,
        "expectedWriteEpoch" to 7L,
        "expectedActiveRevision" to "active-6",
        "subplans" to mapOf(
            "delivery" to mapOf("targetSeasonStartYear" to deliverySeason.toLong()),
            "market" to mapOf("targetSeasonStartYear" to marketSeason.toLong()),
        ),
        "binding" to null,
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
