package com.reguerta.user.data.shifts

import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.domain.shifts.ShiftRepository

class InMemoryShiftRepository(
    private val items: List<ShiftAssignment> = emptyList(),
) : ShiftRepository {
    override suspend fun getAllShifts(): List<ShiftAssignment> =
        items.sortedBy { it.dateMillis }
}
