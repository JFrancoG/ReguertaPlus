package com.reguerta.user.data.shiftswap

import com.reguerta.user.domain.shifts.ShiftSwapRequest
import com.reguerta.user.domain.shifts.ShiftSwapRequestRepository

class ChainedShiftSwapRequestRepository(
    private val primary: ShiftSwapRequestRepository,
    private val fallback: ShiftSwapRequestRepository,
) : ShiftSwapRequestRepository {
    override suspend fun getAllShiftSwapRequests(): List<ShiftSwapRequest> {
        val primaryResult = primary.getAllShiftSwapRequests()
        return if (primaryResult.isNotEmpty()) primaryResult else fallback.getAllShiftSwapRequests()
    }

    override suspend fun upsertShiftSwapRequest(request: ShiftSwapRequest): ShiftSwapRequest =
        runCatching { primary.upsertShiftSwapRequest(request) }
            .getOrElse { fallback.upsertShiftSwapRequest(request) }
}

