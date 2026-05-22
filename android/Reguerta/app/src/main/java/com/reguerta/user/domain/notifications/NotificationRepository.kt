package com.reguerta.user.domain.notifications

interface NotificationRepository {
    suspend fun getAllNotifications(): List<NotificationEvent>

    suspend fun getReadNotificationIds(memberId: String): Set<String>

    suspend fun markNotificationsRead(
        memberId: String,
        notificationIds: Set<String>,
        readAtMillis: Long,
    )

    suspend fun sendNotification(event: NotificationEvent): NotificationEvent
}
