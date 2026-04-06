package com.reguerta.user.data.shiftplanning

import com.reguerta.user.domain.shifts.ShiftPlanningRequest
import com.reguerta.user.domain.shifts.ShiftPlanningRequestRepository

class ChainedShiftPlanningRequestRepository(
    private val primary: ShiftPlanningRequestRepository,
    private val fallback: ShiftPlanningRequestRepository,
) : ShiftPlanningRequestRepository {
    override suspend fun submitShiftPlanningRequest(request: ShiftPlanningRequest): ShiftPlanningRequest {
        val fallbackSaved = fallback.submitShiftPlanningRequest(request)
        return runCatching { primary.submitShiftPlanningRequest(fallbackSaved) }.getOrDefault(fallbackSaved)
    }
}
