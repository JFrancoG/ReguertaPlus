package com.reguerta.user.data.notifications

import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.notifications.NotificationEvent
import com.reguerta.user.domain.notifications.NotificationRepository
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class InMemoryNotificationRepository : NotificationRepository {
    private val mutex = Mutex()
    private val notifications = mutableMapOf(
        "notification_welcome_001" to NotificationEvent(
            id = "notification_welcome_001",
            title = "Bienvenida a La Reguerta",
            body = "Aquí verás recordatorios y avisos extraordinarios enviados por la administración.",
            type = "admin_broadcast",
            target = "all",
            userIds = emptyList(),
            segmentType = null,
            targetRole = null,
            createdBy = "system",
            sentAtMillis = 1_711_849_600_000,
            weekKey = null,
        ),
        "notification_admin_001" to NotificationEvent(
            id = "notification_admin_001",
            title = "Canal admin disponible",
            body = "Este entorno de pruebas ya puede enviar notificaciones extraordinarias desde la app.",
            type = "admin_broadcast",
            target = "segment",
            userIds = emptyList(),
            segmentType = "role",
            targetRole = MemberRole.ADMIN,
            createdBy = "system",
            sentAtMillis = 1_712_108_800_000,
            weekKey = null,
        ),
    )
    private val readNotificationIdsByMember = mutableMapOf<String, MutableSet<String>>()

    override suspend fun getAllNotifications(): List<NotificationEvent> = mutex.withLock {
        notifications.values.sortedByDescending { it.sentAtMillis }
    }

    override suspend fun getReadNotificationIds(memberId: String): Set<String> = mutex.withLock {
        readNotificationIdsByMember[memberId]?.toSet().orEmpty()
    }

    override suspend fun markNotificationsRead(
        memberId: String,
        notificationIds: Set<String>,
        readAtMillis: Long,
    ) = mutex.withLock {
        if (notificationIds.isEmpty()) return@withLock
        val readIds = readNotificationIdsByMember.getOrPut(memberId) { mutableSetOf() }
        readIds.addAll(notificationIds.filter(String::isNotBlank))
    }

    override suspend fun sendNotification(event: NotificationEvent): NotificationEvent = mutex.withLock {
        val eventId = event.id.ifBlank { "notification_${notifications.size + 1}" }
        val persisted = event.copy(id = eventId)
        notifications[eventId] = persisted
        persisted
    }
}
