package com.reguerta.user.data.calendar

import com.google.android.gms.tasks.Tasks
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Source
import com.reguerta.user.data.firestore.ReguertaFirestoreCollection
import com.reguerta.user.data.firestore.ReguertaFirestoreDocument
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.firestore.ReguertaFirestorePath
import com.reguerta.user.data.firestore.toRepositoryException
import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import com.reguerta.user.domain.calendar.DeliveryCalendarOverride
import com.reguerta.user.domain.calendar.DeliveryCalendarRepository
import com.reguerta.user.domain.calendar.DeliveryWeekday
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.Date

class FirestoreDeliveryCalendarRepository(
    private val firestore: FirebaseFirestore,
    private val environment: ReguertaFirestoreEnvironment? = null,
) : DeliveryCalendarRepository {
    private val firestorePath = ReguertaFirestorePath(environment = environment)

    private val calendarCollectionPath: String
        get() = firestorePath.collectionPath(ReguertaFirestoreCollection.DELIVERY_CALENDAR)

    private val memberConfigDocumentPath: String
        get() = firestorePath.documentPath(
            collection = ReguertaFirestoreCollection.CONFIG,
            documentId = ReguertaFirestoreDocument.MEMBER.wireValue,
        )

    private val globalConfigDocumentPath: String
        get() = firestorePath.documentPath(
            collection = ReguertaFirestoreCollection.CONFIG,
            documentId = ReguertaFirestoreDocument.GLOBAL.wireValue,
        )

    override suspend fun getDefaultDeliveryDayOfWeek(): DeliveryWeekday? = withContext(Dispatchers.IO) {
        try {
            val candidates = mutableListOf<Pair<Boolean, Map<String, Any?>>>()
            for (documentPath in listOf(memberConfigDocumentPath, globalConfigDocumentPath)) {
                val snapshot = Tasks.await(firestore.document(documentPath).get(Source.SERVER))
                val exists = snapshot.exists()
                candidates += exists to (snapshot.data ?: emptyMap())
                if (exists) break
            }
            decodeDefaultDeliveryWeekdayCandidates(candidates)
        } catch (error: Exception) {
            throw error.toRepositoryException(resource = "deliveryCalendar.default")
        }
    }

    override suspend fun getAllOverrides(): List<DeliveryCalendarOverride> = withContext(Dispatchers.IO) {
        try {
            val snapshot = Tasks.await(firestore.collection(calendarCollectionPath).get(Source.SERVER))
            decodeDeliveryCalendarOverrideDocuments(
                snapshot.documents.map { document ->
                    document.id to (document.data ?: invalidDeliveryCalendarDocument())
                },
            )
        } catch (error: Exception) {
            throw error.toRepositoryException(resource = "deliveryCalendar.overrides")
        }
    }

    override suspend fun upsertOverride(override: DeliveryCalendarOverride): DeliveryCalendarOverride = withContext(Dispatchers.IO) {
        val payload = mapOf(
            "weekKey" to override.weekKey,
            "deliveryDate" to Timestamp(Date(override.deliveryDateMillis)),
            "ordersBlockedDate" to Timestamp(Date(override.ordersBlockedDateMillis)),
            "ordersOpenAt" to Timestamp(Date(override.ordersOpenAtMillis)),
            "ordersCloseAt" to Timestamp(Date(override.ordersCloseAtMillis)),
            "updatedBy" to override.updatedBy,
            "updatedAt" to Timestamp(Date(override.updatedAtMillis)),
        )
        try {
            Tasks.await(
                firestore.document("$calendarCollectionPath/${override.weekKey}").set(payload),
            )
            override
        } catch (error: Exception) {
            throw error.toRepositoryException(resource = "deliveryCalendar.write")
        }
    }

    override suspend fun deleteOverride(weekKey: String) {
        withContext(Dispatchers.IO) {
            try {
                Tasks.await(
                    firestore.document("$calendarCollectionPath/$weekKey").delete(),
                )
            } catch (error: Exception) {
                throw error.toRepositoryException(resource = "deliveryCalendar.write")
            }
        }
    }
}

internal fun decodeDefaultDeliveryWeekday(
    documentExists: Boolean,
    data: Map<String, Any?>,
): DeliveryWeekday? {
    if (!documentExists) return null
    deliveryWeekdayKeys.forEach { key ->
        if (data.containsKey(key)) return data.requiredDeliveryWeekday(key)
    }
    if (data.containsKey("otherConfig")) {
        val otherConfig = data["otherConfig"].toConfigStringKeyedMap()
        deliveryWeekdayKeys.forEach { key ->
            if (otherConfig.containsKey(key)) return otherConfig.requiredDeliveryWeekday(key)
        }
    }
    return invalidDeliveryCalendarConfiguration()
}

internal fun decodeDefaultDeliveryWeekdayCandidates(
    candidates: List<Pair<Boolean, Map<String, Any?>>>,
): DeliveryWeekday {
    candidates.forEach { (documentExists, data) ->
        decodeDefaultDeliveryWeekday(documentExists, data)?.let { return it }
    }
    throw RepositoryException(
        kind = RepositoryErrorKind.NOT_FOUND,
        resource = "deliveryCalendar.default",
    )
}

internal fun decodeDeliveryCalendarOverrideDocuments(
    documents: List<Pair<String, Map<String, Any?>>>,
): List<DeliveryCalendarOverride> = documents
    .map { (documentId, data) -> decodeDeliveryCalendarOverrideDocument(documentId, data) }
    .sortedBy { it.weekKey }

private fun decodeDeliveryCalendarOverrideDocument(
    documentId: String,
    data: Map<String, Any?>,
): DeliveryCalendarOverride {
    val weekKey = data.requiredString("weekKey")
    if (weekKey != documentId) invalidDeliveryCalendarDocument()
    return DeliveryCalendarOverride(
        weekKey = weekKey,
        deliveryDateMillis = data.requiredTimestampMillis("deliveryDate"),
        ordersBlockedDateMillis = data.requiredTimestampMillis("ordersBlockedDate"),
        ordersOpenAtMillis = data.requiredTimestampMillis("ordersOpenAt"),
        ordersCloseAtMillis = data.requiredTimestampMillis("ordersCloseAt"),
        updatedBy = data.requiredString("updatedBy"),
        updatedAtMillis = data.requiredTimestampMillis("updatedAt"),
    )
}

private fun Map<String, Any?>.requiredDeliveryWeekday(field: String): DeliveryWeekday {
    val raw = this[field] as? String ?: invalidDeliveryCalendarConfiguration()
    return DeliveryWeekday.fromWireValue(raw) ?: invalidDeliveryCalendarConfiguration()
}

private fun Map<String, Any?>.requiredString(field: String): String =
    optionalString(field) ?: invalidDeliveryCalendarDocument()

private fun Map<String, Any?>.optionalString(field: String): String? {
    if (!containsKey(field) || this[field] == null) return null
    val value = this[field] as? String ?: invalidDeliveryCalendarDocument()
    return value.trim().ifBlank { null }
}

private fun Map<String, Any?>.requiredTimestampMillis(field: String): Long =
    optionalTimestampMillis(field) ?: invalidDeliveryCalendarDocument()

private fun Map<String, Any?>.optionalTimestampMillis(field: String): Long? {
    if (!containsKey(field) || this[field] == null) return null
    return (this[field] as? Timestamp)?.toDate()?.time ?: invalidDeliveryCalendarDocument()
}

private fun Any?.toConfigStringKeyedMap(): Map<String, Any?> {
    val raw = this as? Map<*, *> ?: invalidDeliveryCalendarConfiguration()
    return raw.entries.associate { (key, value) ->
        (key as? String ?: invalidDeliveryCalendarConfiguration()) to value
    }
}

private fun invalidDeliveryCalendarDocument(): Nothing = throw RepositoryException(
    kind = RepositoryErrorKind.INVALID_DATA,
    resource = "deliveryCalendar.document",
)

private fun invalidDeliveryCalendarConfiguration(): Nothing = throw RepositoryException(
    kind = RepositoryErrorKind.INVALID_DATA,
    resource = "deliveryCalendar.default",
)

private val deliveryWeekdayKeys = listOf("deliveryDayOfWeek", "deliveryDateOfWeek")
