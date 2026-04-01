package com.reguerta.user.domain.notifications

import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRole

data class NotificationEvent(
    val id: String,
    val title: String,
    val body: String,
    val type: String,
    val target: String,
    val userIds: List<String>,
    val segmentType: String?,
    val targetRole: MemberRole?,
    val createdBy: String,
    val sentAtMillis: Long,
    val weekKey: String?,
) {
    fun isVisibleTo(member: Member): Boolean =
        when (target) {
            "all" -> true
            "users" -> userIds.contains(member.id)
            "segment" -> when (segmentType) {
                "role" -> targetRole?.let { member.roles.contains(it) } ?: false
                else -> false
            }
            else -> false
        }
}
