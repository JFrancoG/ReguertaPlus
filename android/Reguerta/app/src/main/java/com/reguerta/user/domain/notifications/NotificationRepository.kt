package com.reguerta.user.domain.notifications

interface NotificationRepository {
    suspend fun getAllNotifications(): List<NotificationEvent>

    suspend fun sendNotification(event: NotificationEvent): NotificationEvent
}
