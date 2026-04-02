package com.reguerta.user.domain.shifts

interface ShiftRepository {
    suspend fun getAllShifts(): List<ShiftAssignment>
}
