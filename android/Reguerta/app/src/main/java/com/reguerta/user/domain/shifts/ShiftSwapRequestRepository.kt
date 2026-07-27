package com.reguerta.user.domain.shifts

interface ShiftSwapRequestRepository {
    suspend fun getAllShiftSwapRequests(): List<ShiftSwapRequest>

    suspend fun createShiftSwapRequest(requestedShiftId: String, reason: String): String

    suspend fun respondToShiftSwapRequest(
        requestId: String,
        candidateShiftId: String,
        response: ShiftSwapResponseStatus,
    )

    suspend fun cancelShiftSwapRequest(requestId: String)

    suspend fun applyShiftSwapRequest(requestId: String, candidateShiftId: String)
}
