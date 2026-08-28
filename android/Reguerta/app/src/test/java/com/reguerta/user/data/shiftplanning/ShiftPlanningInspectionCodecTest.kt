package com.reguerta.user.data.shiftplanning

import com.google.firebase.Timestamp
import com.reguerta.user.domain.RepositoryException
import com.reguerta.user.domain.shifts.ShiftPlanningMode
import com.reguerta.user.domain.shifts.ShiftPlanningRequestStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test

class ShiftPlanningInspectionCodecTest {
    @Test
    fun `legacy request is not exposed as v2 observation`() {
        assertNull(
            decodeShiftPlanningObservation(
                documentId = "legacy-request",
                data = mapOf(
                    "type" to "delivery",
                    "status" to "completed",
                ),
            ),
        )
    }

    @Test
    fun `completed stage exposes exact summary and candidate reference`() {
        val observation = requireNotNull(
            decodeShiftPlanningObservation(
                documentId = "stage-request",
                data = completedStageRequest(),
            ),
        )

        assertEquals(ShiftPlanningMode.STAGE, observation.mode)
        assertEquals(ShiftPlanningRequestStatus.COMPLETED, observation.status)
        assertEquals(52, observation.completedSummary?.delivery?.generatedShiftCount)
        assertEquals("bundle-2026", observation.candidateReference?.candidateId)
        assertEquals("candidate-digest", observation.candidateReference?.candidateDigest)
    }

    @Test
    fun `candidate rejects a position count different from its manifest`() {
        val reference = requireNotNull(
            decodeShiftPlanningObservation("stage-request", completedStageRequest())?.candidateReference,
        )

        assertThrows(RepositoryException::class.java) {
            decodeShiftPlanningCandidate(
                documentId = "bundle-2026",
                data = candidateHeader(positionDocumentCount = 2),
                positionDocuments = listOf(
                    "delivery-1" to candidatePosition("delivery-1"),
                ),
                reference = reference,
            )
        }
    }

    @Test
    fun `completed summary rejects an invalid projection season`() {
        assertThrows(RepositoryException::class.java) {
            decodeShiftPlanningObservation(
                documentId = "stage-request",
                data = completedStageRequest(deliverySeasons = listOf(-1L)),
            )
        }
    }

    private fun completedStageRequest(
        deliverySeasons: List<Long> = listOf(2026L, 2027L),
    ): Map<String, Any?> = mapOf(
        "schemaVersion" to 2L,
        "requestId" to "stage-request",
        "bundleId" to "bundle-2026",
        "environment" to "develop",
        "requestedByUserId" to "admin-1",
        "requestedAt" to Timestamp(1_800_000_000L, 0),
        "mode" to "stage",
        "status" to "completed",
        "lifecycle" to mapOf(
            "state" to "completed",
            "summary" to mapOf(
                "schemaVersion" to 1L,
                "status" to "completed",
                "mode" to "stage",
                "bundleId" to "bundle-2026",
                "bundleRevision" to "revision-1",
                "bundleDigest" to "bundle-digest",
                "delivery" to subplan(2026, 52, deliverySeasons),
                "market" to subplan(2026, 12, listOf(2026L)),
            ),
            "artifact" to mapOf(
                "kind" to "candidate",
                "candidateId" to "bundle-2026",
                "candidateDigest" to "candidate-digest",
                "bundleArtifactDigest" to "artifact-digest",
            ),
        ),
    )

    private fun subplan(target: Long, count: Long, seasons: List<Long>): Map<String, Any?> = mapOf(
        "targetSeasonStartYear" to target,
        "generatedShiftCount" to count,
        "affectedProjectionSeasonStartYears" to seasons,
    )

    private fun candidateHeader(positionDocumentCount: Long): Map<String, Any?> = mapOf(
        "schemaVersion" to 1L,
        "status" to "staged",
        "environment" to "develop",
        "bundleId" to "bundle-2026",
        "bundleRevision" to "revision-1",
        "bundleDigest" to "bundle-digest",
        "candidateDigest" to "candidate-digest",
        "candidate" to mapOf(
            "candidateId" to "bundle-2026",
            "positionManifest" to mapOf(
                "positionDocumentCount" to positionDocumentCount,
                "assignmentPositionCount" to 2L,
            ),
        ),
    )

    private fun candidatePosition(id: String): Map<String, Any?> = mapOf(
        "schemaVersion" to 1L,
        "candidateId" to "bundle-2026",
        "candidateDigest" to "candidate-digest",
        "positionId" to id,
        "position" to mapOf(
            "positionId" to id,
            "candidateId" to "bundle-2026",
            "type" to "delivery",
            "scheduledDate" to "2026-09-02",
            "assignedUserIds" to listOf("member-1"),
            "helperUserId" to "member-2",
            "bundleRevision" to "revision-1",
            "bundleDigest" to "bundle-digest",
        ),
    )
}
