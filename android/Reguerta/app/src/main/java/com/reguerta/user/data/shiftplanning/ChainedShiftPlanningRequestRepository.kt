package com.reguerta.user.data.shiftplanning

import com.reguerta.user.domain.shifts.ShiftPlanningRequest
import com.reguerta.user.domain.shifts.ShiftPlanningRequestRepository

class ChainedShiftPlanningRequestRepository(
    private val primary: ShiftPlanningRequestRepository,
    @Suppress("UNUSED_PARAMETER") fallback: ShiftPlanningRequestRepository,
) : ShiftPlanningRequestRepository {
    override suspend fun submitShiftPlanningRequest(request: ShiftPlanningRequest): ShiftPlanningRequest =
        primary.submitShiftPlanningRequest(request)
}
