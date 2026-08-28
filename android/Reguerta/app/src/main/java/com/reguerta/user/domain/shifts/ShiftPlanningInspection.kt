package com.reguerta.user.domain.shifts

import kotlinx.coroutines.flow.Flow

enum class ShiftPlanningMode {
    PREVIEW,
    STAGE,
    ACTIVATE,
}

data class ShiftPlanningSubplanSummary(
    val targetSeasonStartYear: Int,
    val generatedShiftCount: Int,
    val affectedProjectionSeasonStartYears: List<Int>,
)

data class ShiftPlanningCompletedSummary(
    val delivery: ShiftPlanningSubplanSummary,
    val market: ShiftPlanningSubplanSummary,
)

data class ShiftPlanningFailure(
    val scope: String,
    val code: String,
    val messageKey: String,
)

data class ShiftPlanningCandidateReference(
    val candidateId: String,
    val candidateDigest: String,
    val bundleRevision: String,
    val bundleDigest: String,
    val environment: String,
)

data class ShiftPlanningRequestObservation(
    val id: String,
    val bundleId: String,
    val requestedByUserId: String,
    val requestedAtMillis: Long,
    val mode: ShiftPlanningMode,
    val status: ShiftPlanningRequestStatus,
    val completedSummary: ShiftPlanningCompletedSummary?,
    val failure: ShiftPlanningFailure?,
    val candidateReference: ShiftPlanningCandidateReference?,
)

data class ShiftPlanningCandidatePosition(
    val id: String,
    val type: ShiftPlanningRequestType,
    val scheduledDate: String,
    val assignedUserIds: List<String>,
    val helperUserId: String?,
)

data class ShiftPlanningCandidate(
    val id: String,
    val bundleRevision: String,
    val bundleDigest: String,
    val candidateDigest: String,
    val positionDocumentCount: Int,
    val assignmentPositionCount: Int,
    val positions: List<ShiftPlanningCandidatePosition>,
)

interface ShiftPlanningInspectionRepository {
    fun observeLatestRequest(): Flow<ShiftPlanningRequestObservation?>

    suspend fun getStagedCandidate(reference: ShiftPlanningCandidateReference): ShiftPlanningCandidate
}
