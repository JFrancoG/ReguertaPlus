package com.reguerta.user.data.shifts

import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.domain.shifts.ShiftRepository

class ChainedShiftRepository(
    private val primary: ShiftRepository,
    @Suppress("UNUSED_PARAMETER") fallback: ShiftRepository,
) : ShiftRepository {
    override suspend fun getAllShifts(): List<ShiftAssignment> = primary.getAllShifts()

    override suspend fun upsertShift(shift: ShiftAssignment): ShiftAssignment =
        primary.upsertShift(shift)
}
