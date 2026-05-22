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

    override suspend fun getReadNotificationIds(memberId: String): Set<String> {
        val primaryReadIds = runCatching { primary.getReadNotificationIds(memberId) }.getOrDefault(emptySet())
        val fallbackReadIds = fallback.getReadNotificationIds(memberId)
        return primaryReadIds + fallbackReadIds
    }

    override suspend fun markNotificationsRead(
        memberId: String,
        notificationIds: Set<String>,
        readAtMillis: Long,
    ) {
        if (notificationIds.isEmpty()) return
        fallback.markNotificationsRead(memberId, notificationIds, readAtMillis)
        runCatching {
            primary.markNotificationsRead(memberId, notificationIds, readAtMillis)
        }
    }

    override suspend fun sendNotification(event: NotificationEvent): NotificationEvent {
        val fallbackSaved = fallback.sendNotification(event)
        val primarySaved = runCatching { primary.sendNotification(event) }.getOrNull()
        return primarySaved ?: fallbackSaved
    }
}
