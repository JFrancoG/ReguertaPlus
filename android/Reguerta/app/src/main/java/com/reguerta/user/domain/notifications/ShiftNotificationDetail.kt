package com.reguerta.user.domain.notifications

import com.reguerta.user.domain.shifts.ShiftAssignment

data class ShiftNotificationDetail(
    val eventId: String,
    val assignmentRevision: Long,
    val documentRevision: Long,
    val shift: ShiftAssignment,
)

interface ShiftNotificationDetailRepository {
    suspend fun getCurrentDetail(
        eventId: String,
        memberId: String,
    ): ShiftNotificationDetail
}
