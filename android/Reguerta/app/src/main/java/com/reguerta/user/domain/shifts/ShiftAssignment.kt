package com.reguerta.user.domain.shifts

enum class ShiftType {
    DELIVERY,
    MARKET,
}

enum class ShiftStatus {
    PLANNED,
    SWAP_PENDING,
    CONFIRMED,
}

data class ShiftAssignment(
    val id: String,
    val type: ShiftType,
    val dateMillis: Long,
    val assignedUserIds: List<String>,
    val helperUserId: String?,
    val status: ShiftStatus,
    val source: String,
    val createdAtMillis: Long,
    val updatedAtMillis: Long,
) {
    fun isAssignedTo(userId: String): Boolean =
        assignedUserIds.contains(userId) || helperUserId == userId
}
