package com.reguerta.user.data.notifications

import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.reguerta.user.data.firestore.ReguertaFirestoreCollection
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.firestore.ReguertaFirestorePath
import com.reguerta.user.data.firestore.toRepositoryException
import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.notifications.NotificationEvent
import com.reguerta.user.domain.notifications.NotificationContentPolicy
import com.reguerta.user.domain.notifications.NotificationRepository
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext

class FirestoreNotificationRepository(
    private val firestore: FirebaseFirestore,
    private val environment: ReguertaFirestoreEnvironment? = null,
) : NotificationRepository {
    private val firestorePath = ReguertaFirestorePath(environment = environment)

    private val notificationsCollectionPath: String
        get() = firestorePath.collectionPath(ReguertaFirestoreCollection.NOTIFICATION_EVENTS)

    private fun notificationInboxCollectionPath(memberId: String): String =
        "${firestorePath.documentPath(ReguertaFirestoreCollection.USERS, memberId)}/notificationInbox"

    private fun notificationReadsCollectionPath(memberId: String): String =
        "${firestorePath.documentPath(ReguertaFirestoreCollection.USERS, memberId)}/notificationReads"

    override suspend fun getNotificationsFor(member: Member): List<NotificationEvent> = withContext(Dispatchers.IO) {
        try {
            val snapshot = firestore.collection(notificationInboxCollectionPath(member.id))
                .get()
                .await()
            decodeNotificationDocuments(
                documents = snapshot.documents.map { document ->
                    document.id to document.data.orEmpty()
                },
                source = NotificationDocumentSource.INBOX,
            )
        } catch (cancellation: CancellationException) {
            throw cancellation
        } catch (error: Exception) {
            throw error.toRepositoryException(resource = "notificationInbox")
        }
    }

    override suspend fun getReadNotificationIds(memberId: String): Set<String> = withContext(Dispatchers.IO) {
        try {
            val snapshot = firestore.collection(notificationReadsCollectionPath(memberId)).get().await()
            snapshot.documents.map { it.id }.toSet()
        } catch (cancellation: CancellationException) {
            throw cancellation
        } catch (error: Exception) {
            throw error.toRepositoryException(resource = "notificationReads")
        }
    }

    override suspend fun markNotificationsRead(
        memberId: String,
        notificationIds: Set<String>,
        readAtMillis: Long,
    ) = withContext(Dispatchers.IO) {
        val normalizedIds = notificationIds.map(String::trim).filter(String::isNotBlank).toSet()
        if (normalizedIds.isEmpty()) return@withContext

        val batch = firestore.batch()
        val readAt = Timestamp(
            readAtMillis / 1_000,
            ((readAtMillis % 1_000) * 1_000_000).toInt(),
        )
        val collection = firestore.collection(notificationReadsCollectionPath(memberId))
        normalizedIds.forEach { notificationId ->
            batch.set(
                collection.document(notificationId),
                mapOf(
                    "notificationEventId" to notificationId,
                    "readAt" to readAt,
                ),
                SetOptions.merge(),
            )
        }
        try {
            batch.commit().await()
            Unit
        } catch (cancellation: CancellationException) {
            throw cancellation
        } catch (error: Exception) {
            throw error.toRepositoryException(resource = "notificationReads")
        }
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
        )
        persisted.weekKey?.let { payload["weekKey"] = it }
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

        try {
            firestore.collection(notificationsCollectionPath)
                .document(documentId)
                .set(payload, SetOptions.merge())
                .await()
            persisted
        } catch (cancellation: CancellationException) {
            throw cancellation
        } catch (error: Exception) {
            throw error.toRepositoryException(resource = "notificationEvents/$documentId")
        }
    }
}

internal enum class NotificationDocumentSource(val resourceCollection: String) {
    EVENT("notificationEvents"),
    INBOX("notificationInbox"),
}

internal fun decodeNotificationDocuments(
    documents: List<Pair<String, Map<String, Any?>>>,
    source: NotificationDocumentSource,
): List<NotificationEvent> = documents
    .map { (documentId, data) -> decodeNotificationDocument(documentId, data, source) }
    .sortedByDescending(NotificationEvent::sentAtMillis)

internal fun decodeNotificationDocument(
    documentId: String,
    data: Map<String, Any?>,
    source: NotificationDocumentSource,
): NotificationEvent = NotificationDocumentDto.decode(documentId, data, source).toDomain()

internal data class NotificationDocumentDto(
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
    val contentPolicy: NotificationContentPolicy,
) {
    fun toDomain(): NotificationEvent = NotificationEvent(
        id = id,
        title = title,
        body = body,
        type = type,
        target = target,
        userIds = userIds,
        segmentType = segmentType,
        targetRole = targetRole,
        createdBy = createdBy,
        sentAtMillis = sentAtMillis,
        weekKey = weekKey,
        contentPolicy = contentPolicy,
    )

    companion object {
        fun decode(
            documentId: String,
            data: Map<String, Any?>,
            source: NotificationDocumentSource,
        ): NotificationDocumentDto {
            if (documentId.isBlank() || documentId != documentId.trim()) {
                invalidNotificationDocument(source, documentId)
            }
            if (source == NotificationDocumentSource.INBOX &&
                data.requiredExactNotificationString("notificationEventId", source, documentId) != documentId
            ) {
                invalidNotificationDocument(source, documentId)
            }
            val type = data.requiredExactNotificationString("type", source, documentId)
            if (type !in CANONICAL_NOTIFICATION_TYPES) {
                invalidNotificationDocument(source, documentId)
            }
            val target = data.requiredExactNotificationString("target", source, documentId)
            val audience = data.requiredNotificationAudience(target, source, documentId)
            val title = data.requiredNotificationString("title", source, documentId)
            val body = data.requiredNotificationString("body", source, documentId)
            val createdBy = data.requiredNotificationString("createdBy", source, documentId)
            val weekKey = data.optionalNotificationString("weekKey", source, documentId)
            return NotificationDocumentDto(
                id = documentId,
                title = title,
                body = body,
                type = type,
                target = target,
                userIds = audience.userIds,
                segmentType = audience.segmentType,
                targetRole = audience.targetRole,
                createdBy = createdBy,
                sentAtMillis = data.requiredNotificationTimestampMillis("sentAt", source, documentId),
                weekKey = weekKey,
                contentPolicy = data.notificationContentPolicy(
                    title = title,
                    body = body,
                    type = type,
                    target = target,
                    audience = audience,
                    createdBy = createdBy,
                    weekKey = weekKey,
                    source = source,
                    documentId = documentId,
                ),
            )
        }
    }
}

private data class DecodedNotificationAudience(
    val userIds: List<String> = emptyList(),
    val segmentType: String? = null,
    val targetRole: MemberRole? = null,
)

private fun Map<String, Any?>.notificationContentPolicy(
    title: String,
    body: String,
    type: String,
    target: String,
    audience: DecodedNotificationAudience,
    createdBy: String,
    weekKey: String?,
    source: NotificationDocumentSource,
    documentId: String,
): NotificationContentPolicy {
    val fields = setOf("schemaVersion", "operationKind", "contentPolicy")
    val present = keys.intersect(fields)
    if (present.isEmpty()) return NotificationContentPolicy.EMBEDDED
    val schemaVersion = this["schemaVersion"] as? Number
    if (
        present != fields ||
        schemaVersion?.toDouble() != 1.0 ||
        schemaVersion.toLong() != 1L ||
        this["operationKind"] != "shiftPlanningNotification" ||
        this["contentPolicy"] != "genericReferenceOnly" ||
        title != "Turnos actualizados" ||
        body != "Consulta la aplicación para ver la información actualizada." ||
        type != "shift_updated" ||
        target != "users" ||
        audience.userIds.size != 1 ||
        audience.segmentType != null ||
        audience.targetRole != null ||
        createdBy != "system" ||
        weekKey != null
    ) {
        invalidNotificationDocument(source, documentId)
    }
    return NotificationContentPolicy.AUTHORIZED_FETCH_REQUIRED
}

private fun Map<String, Any?>.requiredNotificationAudience(
    target: String,
    source: NotificationDocumentSource,
    documentId: String,
): DecodedNotificationAudience {
    val payload = this["targetPayload"] as? Map<*, *>
        ?: invalidNotificationDocument(source, documentId)
    return when (target) {
        "all" -> {
            if (payload.isNotEmpty()) invalidNotificationDocument(source, documentId)
            DecodedNotificationAudience()
        }
        "users" -> {
            if (payload.keys != setOf("userIds")) invalidNotificationDocument(source, documentId)
            val rawUserIds = payload["userIds"] as? List<*>
                ?: invalidNotificationDocument(source, documentId)
            val userIds = rawUserIds.map { value ->
                (value as? String)?.trim()?.ifEmpty {
                    invalidNotificationDocument(source, documentId)
                } ?: invalidNotificationDocument(source, documentId)
            }
            if (userIds.isEmpty()) invalidNotificationDocument(source, documentId)
            DecodedNotificationAudience(userIds = userIds)
        }
        "segment" -> {
            if (payload.keys != setOf("segmentType", "role")) {
                invalidNotificationDocument(source, documentId)
            }
            if (payload["segmentType"] != "role") {
                invalidNotificationDocument(source, documentId)
            }
            val role = when (payload["role"]) {
                "member" -> MemberRole.MEMBER
                "producer" -> MemberRole.PRODUCER
                "admin" -> MemberRole.ADMIN
                else -> invalidNotificationDocument(source, documentId)
            }
            DecodedNotificationAudience(segmentType = "role", targetRole = role)
        }
        else -> invalidNotificationDocument(source, documentId)
    }
}

private fun Map<String, Any?>.requiredNotificationString(
    field: String,
    source: NotificationDocumentSource,
    documentId: String,
): String = optionalNotificationString(field, source, documentId)
    ?: invalidNotificationDocument(source, documentId)

private fun Map<String, Any?>.requiredExactNotificationString(
    field: String,
    source: NotificationDocumentSource,
    documentId: String,
): String {
    val value = this[field] as? String ?: invalidNotificationDocument(source, documentId)
    if (value.isEmpty() || value != value.trim()) invalidNotificationDocument(source, documentId)
    return value
}

private fun Map<String, Any?>.optionalNotificationString(
    field: String,
    source: NotificationDocumentSource,
    documentId: String,
): String? {
    val value = this[field] ?: return null
    if (value !is String) invalidNotificationDocument(source, documentId)
    return value.trim().ifEmpty { invalidNotificationDocument(source, documentId) }
}

private fun Map<String, Any?>.requiredNotificationTimestampMillis(
    field: String,
    source: NotificationDocumentSource,
    documentId: String,
): Long = (this[field] as? Timestamp)?.toDate()?.time
    ?: invalidNotificationDocument(source, documentId)

private fun invalidNotificationDocument(
    source: NotificationDocumentSource,
    documentId: String,
): Nothing = throw RepositoryException(
    kind = RepositoryErrorKind.INVALID_DATA,
    resource = "${source.resourceCollection}/$documentId",
)

private val CANONICAL_NOTIFICATION_TYPES = setOf(
    "order_reminder",
    "order_auto_generated",
    "shift_swap_requested",
    "shift_swap_available",
    "shift_swap_unavailable",
    "shift_swap_accepted",
    "shift_swap_applied",
    "shift_updated",
    "news_published",
    "admin_broadcast",
)

private fun MemberRole.wireValue(): String =
    when (this) {
        MemberRole.MEMBER -> "member"
        MemberRole.PRODUCER -> "producer"
        MemberRole.ADMIN -> "admin"
    }
