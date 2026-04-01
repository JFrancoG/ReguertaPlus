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

    override suspend fun getAllNotifications(): List<NotificationEvent> = mutex.withLock {
        notifications.values.sortedByDescending { it.sentAtMillis }
    }

    override suspend fun sendNotification(event: NotificationEvent): NotificationEvent = mutex.withLock {
        notifications[event.id] = event
        event
    }
}
