package com.reguerta.user.data.shiftplanning

import com.reguerta.user.domain.shifts.ShiftPlanningRequest
import com.reguerta.user.domain.shifts.ShiftPlanningRequestRepository
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.UUID

class InMemoryShiftPlanningRequestRepository : ShiftPlanningRequestRepository {
    private val mutex = Mutex()
    private val requests = LinkedHashMap<String, ShiftPlanningRequest>()

    override suspend fun submitShiftPlanningRequest(request: ShiftPlanningRequest): ShiftPlanningRequest = mutex.withLock {
        val persisted = request.copy(
            id = request.id.ifBlank { UUID.randomUUID().toString() },
        )
        requests[persisted.id] = persisted
        persisted
    }
}
