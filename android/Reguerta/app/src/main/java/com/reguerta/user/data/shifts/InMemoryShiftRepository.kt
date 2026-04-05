package com.reguerta.user.data.shifts

import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.domain.shifts.ShiftRepository
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class InMemoryShiftRepository(
    private val items: List<ShiftAssignment> = emptyList(),
) : ShiftRepository {
    private val mutex = Mutex()
    private val shifts = items.associateBy { it.id }.toMutableMap()

    override suspend fun getAllShifts(): List<ShiftAssignment> = mutex.withLock {
        shifts.values.sortedBy { it.dateMillis }
    }

    override suspend fun upsertShift(shift: ShiftAssignment): ShiftAssignment = mutex.withLock {
        shifts[shift.id] = shift
        shift
    }
}
