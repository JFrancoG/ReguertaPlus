package com.reguerta.user.domain.notifications

import com.reguerta.user.domain.access.Member

interface NotificationRepository {
    suspend fun getNotificationsFor(member: Member): List<NotificationEvent>

    suspend fun getReadNotificationIds(memberId: String): Set<String>

    suspend fun markNotificationsRead(
        memberId: String,
        notificationIds: Set<String>,
        readAtMillis: Long,
    )

    suspend fun sendNotification(event: NotificationEvent): NotificationEvent
}
