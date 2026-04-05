package com.reguerta.user.data.shiftswap

import com.reguerta.user.domain.shifts.ShiftSwapRequest
import com.reguerta.user.domain.shifts.ShiftSwapRequestRepository
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class InMemoryShiftSwapRequestRepository : ShiftSwapRequestRepository {
    private val mutex = Mutex()
    private val requests = mutableMapOf<String, ShiftSwapRequest>()

    override suspend fun getAllShiftSwapRequests(): List<ShiftSwapRequest> = mutex.withLock {
        requests.values.sortedByDescending { it.requestedAtMillis }
    }

    override suspend fun upsertShiftSwapRequest(request: ShiftSwapRequest): ShiftSwapRequest = mutex.withLock {
        val persisted = request.copy(
            id = request.id.ifBlank { "swap_${request.requestedShiftId}_${request.requesterUserId}" },
        )
        requests[persisted.id] = persisted
        persisted
    }
}
