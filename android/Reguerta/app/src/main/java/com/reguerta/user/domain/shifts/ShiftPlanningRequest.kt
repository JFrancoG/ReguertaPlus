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

data class ShiftPlanningRequest(
    val id: String,
    val bundleId: String,
    val requestedByUserId: String,
    val requestedAtMillis: Long,
    val deliveryTargetSeasonStartYear: Int,
    val marketTargetSeasonStartYear: Int,
)
