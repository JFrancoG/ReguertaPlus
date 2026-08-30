package com.reguerta.user.data.shifts

import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.domain.shifts.ShiftRepository

class InMemoryShiftRepository(
    private val items: List<ShiftAssignment> = emptyList(),
) : ShiftRepository {
    private val shifts = items.associateBy { it.id }

    override suspend fun getAllShifts(): List<ShiftAssignment> = shifts.values.sortedBy { it.dateMillis }
}
