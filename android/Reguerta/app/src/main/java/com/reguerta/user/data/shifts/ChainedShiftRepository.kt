package com.reguerta.user.data.shifts

import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.domain.shifts.ShiftRepository

class ChainedShiftRepository(
    private val primary: ShiftRepository,
    private val fallback: ShiftRepository,
) : ShiftRepository {
    override suspend fun getAllShifts(): List<ShiftAssignment> {
        val primaryResult = primary.getAllShifts()
        return if (primaryResult.isNotEmpty()) {
            primaryResult
        } else {
            fallback.getAllShifts()
        }
    }

    override suspend fun upsertShift(shift: ShiftAssignment): ShiftAssignment =
        runCatching { primary.upsertShift(shift) }
            .getOrElse { fallback.upsertShift(shift) }
}
