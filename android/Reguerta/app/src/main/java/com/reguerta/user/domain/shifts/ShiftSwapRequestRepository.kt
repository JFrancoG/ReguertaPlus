package com.reguerta.user.domain.shifts

interface ShiftSwapRequestRepository {
    suspend fun getAllShiftSwapRequests(): List<ShiftSwapRequest>
    suspend fun upsertShiftSwapRequest(request: ShiftSwapRequest): ShiftSwapRequest
}

