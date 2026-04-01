package com.reguerta.user.data.notifications

import com.reguerta.user.domain.notifications.NotificationEvent
import com.reguerta.user.domain.notifications.NotificationRepository

class ChainedNotificationRepository(
    private val primary: NotificationRepository,
    private val fallback: NotificationRepository,
) : NotificationRepository {
    override suspend fun getAllNotifications(): List<NotificationEvent> {
        val primaryNotifications = primary.getAllNotifications()
        return if (primaryNotifications.isNotEmpty()) primaryNotifications else fallback.getAllNotifications()
    }

    override suspend fun sendNotification(event: NotificationEvent): NotificationEvent {
        val fallbackSaved = fallback.sendNotification(event)
        val primarySaved = runCatching { primary.sendNotification(event) }.getOrNull()
        return primarySaved ?: fallbackSaved
    }
}
