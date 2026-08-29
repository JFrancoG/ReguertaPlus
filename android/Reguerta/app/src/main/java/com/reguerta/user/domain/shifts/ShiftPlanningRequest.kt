package com.reguerta.user.domain.shifts

enum class ShiftPlanningRequestType {
    DELIVERY,
    MARKET,
}

enum class ShiftPlanningRequestStatus {
    REQUESTED,
    PROCESSING,
    COMPLETED,
    FAILED,
}

data class ShiftPlanningPreviewReference(
    val sourceRequestId: String,
    val bundleRevision: String,
    val bundleDigest: String,
)

sealed interface ShiftPlanningRequestIntent {
    data object Preview : ShiftPlanningRequestIntent

    data class Stage(
        val preview: ShiftPlanningPreviewReference,
    ) : ShiftPlanningRequestIntent
}

data class ShiftPlanningRequest(
    val id: String,
    val bundleId: String,
    val requestedByUserId: String,
    val requestedAtMillis: Long,
    val deliveryTargetSeasonStartYear: Int,
    val marketTargetSeasonStartYear: Int,
    val intent: ShiftPlanningRequestIntent = ShiftPlanningRequestIntent.Preview,
)
