package com.reguerta.user.domain.shifts

interface ShiftPlanningRequestRepository {
    suspend fun submitShiftPlanningRequest(request: ShiftPlanningRequest): ShiftPlanningRequest
}
