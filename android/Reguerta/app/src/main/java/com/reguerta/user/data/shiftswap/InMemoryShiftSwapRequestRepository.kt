package com.reguerta.user.data.shiftswap

import com.reguerta.user.domain.shifts.ShiftSwapRequest
import com.reguerta.user.domain.shifts.ShiftSwapRequestRepository
import com.reguerta.user.domain.shifts.ShiftSwapRequestStatus
import com.reguerta.user.domain.shifts.ShiftSwapResponse
import com.reguerta.user.domain.shifts.ShiftSwapResponseStatus
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class InMemoryShiftSwapRequestRepository(
    private val actorMemberId: String = "test_member",
) : ShiftSwapRequestRepository {
    private val mutex = Mutex()
    private val requests = mutableMapOf<String, ShiftSwapRequest>()

    override suspend fun getAllShiftSwapRequests(): List<ShiftSwapRequest> = mutex.withLock {
        requests.values.sortedByDescending { it.requestedAtMillis }
    }

    override suspend fun createShiftSwapRequest(requestedShiftId: String, reason: String): String = mutex.withLock {
        val requestId = "swap_${requestedShiftId}_$actorMemberId"
        requests[requestId] = ShiftSwapRequest(
            id = requestId,
            requestedShiftId = requestedShiftId,
            requesterUserId = actorMemberId,
            reason = reason,
            status = ShiftSwapRequestStatus.OPEN,
            candidates = emptyList(),
            responses = emptyList(),
            selectedCandidateUserId = null,
            selectedCandidateShiftId = null,
            requestedAtMillis = System.currentTimeMillis(),
            confirmedAtMillis = null,
            appliedAtMillis = null,
        )
        requestId
    }

    override suspend fun respondToShiftSwapRequest(
        requestId: String,
        candidateShiftId: String,
        response: ShiftSwapResponseStatus,
    ) = mutex.withLock {
        val request = checkNotNull(requests[requestId])
        val updatedResponse = ShiftSwapResponse(
            userId = actorMemberId,
            shiftId = candidateShiftId,
            status = response,
            respondedAtMillis = System.currentTimeMillis(),
        )
        requests[requestId] = request.copy(
            responses = request.responses
                .filterNot { it.userId == actorMemberId && it.shiftId == candidateShiftId }
                .plus(updatedResponse),
        )
    }

    override suspend fun cancelShiftSwapRequest(requestId: String) = mutex.withLock {
        val request = checkNotNull(requests[requestId])
        requests[requestId] = request.copy(status = ShiftSwapRequestStatus.CANCELLED)
    }

    override suspend fun applyShiftSwapRequest(requestId: String, candidateShiftId: String) = mutex.withLock {
        val request = checkNotNull(requests[requestId])
        val candidateUserId = request.candidates.firstOrNull { it.shiftId == candidateShiftId }?.userId
        val now = System.currentTimeMillis()
        requests[requestId] = request.copy(
            status = ShiftSwapRequestStatus.APPLIED,
            selectedCandidateUserId = candidateUserId,
            selectedCandidateShiftId = candidateShiftId,
            confirmedAtMillis = now,
            appliedAtMillis = now,
        )
    }
}
