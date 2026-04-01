package com.reguerta.user.data.notifications

import com.google.android.gms.tasks.Tasks
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.reguerta.user.data.firestore.ReguertaFirestoreCollection
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.firestore.ReguertaFirestorePath
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.notifications.NotificationEvent
import com.reguerta.user.domain.notifications.NotificationRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class FirestoreNotificationRepository(
    private val firestore: FirebaseFirestore,
    private val environment: ReguertaFirestoreEnvironment = ReguertaFirestoreEnvironment.DEVELOP,
) : NotificationRepository {
    private val firestorePath = ReguertaFirestorePath(environment = environment)

    private val notificationsCollectionPath: String
        get() = firestorePath.collectionPath(ReguertaFirestoreCollection.NOTIFICATION_EVENTS)

    override suspend fun getAllNotifications(): List<NotificationEvent> = withContext(Dispatchers.IO) {
        runCatching {
            val snapshot = Tasks.await(
                firestore.collection(notificationsCollectionPath).get(),
            )
            snapshot.documents
                .mapNotNull { it.toNotificationEvent() }
                .sortedByDescending { it.sentAtMillis }
        }.getOrDefault(emptyList())
    }

    override suspend fun sendNotification(event: NotificationEvent): NotificationEvent = withContext(Dispatchers.IO) {
        val documentId = event.id.ifBlank {
            firestore.collection(notificationsCollectionPath).document().id
        }
        val persisted = event.copy(id = documentId)
        val payload = mutableMapOf<String, Any?>(
            "title" to persisted.title,
            "body" to persisted.body,
            "type" to persisted.type,
            "target" to persisted.target,
            "sentAt" to Timestamp(
                persisted.sentAtMillis / 1_000,
                ((persisted.sentAtMillis % 1_000) * 1_000_000).toInt(),
            ),
            "createdBy" to persisted.createdBy,
            "weekKey" to persisted.weekKey,
        )
        val targetPayload = when (persisted.target) {
            "users" -> mapOf("userIds" to persisted.userIds)
            "segment" -> when (persisted.segmentType) {
                "role" -> mapOf(
                    "segmentType" to "role",
                    "role" to persisted.targetRole?.wireValue(),
                )
                else -> emptyMap<String, Any?>()
            }
            else -> emptyMap<String, Any?>()
        }
        payload["targetPayload"] = targetPayload

        runCatching {
            Tasks.await(
                firestore.collection(notificationsCollectionPath)
                    .document(documentId)
                    .set(payload, SetOptions.merge()),
            )
            persisted
        }.getOrDefault(persisted)
    }
}

private fun com.google.firebase.firestore.DocumentSnapshot.toNotificationEvent(): NotificationEvent? {
    val title = getString("title")?.trim().orEmpty()
    val body = getString("body")?.trim().orEmpty()
    val type = getString("type")?.trim().orEmpty()
    val target = getString("target")?.trim().orEmpty()
    if (title.isBlank() || body.isBlank() || type.isBlank() || target.isBlank()) {
        return null
    }

    val targetPayload = get("targetPayload") as? Map<*, *>
    val userIds = (targetPayload?.get("userIds") as? List<*>)?.mapNotNull { it as? String }.orEmpty()
    val segmentType = (targetPayload?.get("segmentType") as? String)?.trim()?.ifBlank { null }
    val targetRole = (targetPayload?.get("role") as? String)?.toMemberRole()

    return NotificationEvent(
        id = id,
        title = title,
        body = body,
        type = type,
        target = target,
        userIds = userIds,
        segmentType = segmentType,
        targetRole = targetRole,
        createdBy = getString("createdBy")?.trim().orEmpty(),
        sentAtMillis = getTimestamp("sentAt")?.toDate()?.time ?: 0L,
        weekKey = getString("weekKey")?.trim()?.ifBlank { null },
    )
}

private fun String.toMemberRole(): MemberRole? =
    when (this.lowercase()) {
        "member" -> MemberRole.MEMBER
        "producer" -> MemberRole.PRODUCER
        "admin" -> MemberRole.ADMIN
        else -> null
    }

private fun MemberRole.wireValue(): String =
    when (this) {
        MemberRole.MEMBER -> "member"
        MemberRole.PRODUCER -> "producer"
        MemberRole.ADMIN -> "admin"
    }
