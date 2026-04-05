package com.reguerta.user.domain.shifts

enum class ShiftSwapRequestStatus {
    OPEN,
    CANCELLED,
    APPLIED,
}

enum class ShiftSwapResponseStatus {
    AVAILABLE,
    UNAVAILABLE,
}

data class ShiftSwapCandidate(
    val userId: String,
    val shiftId: String,
)

data class ShiftSwapResponse(
    val userId: String,
    val shiftId: String,
    val status: ShiftSwapResponseStatus,
    val respondedAtMillis: Long,
)

data class ShiftSwapRequest(
    val id: String,
    val requestedShiftId: String,
    val requesterUserId: String,
    val reason: String,
    val status: ShiftSwapRequestStatus,
    val candidates: List<ShiftSwapCandidate>,
    val responses: List<ShiftSwapResponse>,
    val selectedCandidateUserId: String?,
    val selectedCandidateShiftId: String?,
    val requestedAtMillis: Long,
    val confirmedAtMillis: Long?,
    val appliedAtMillis: Long?,
)
