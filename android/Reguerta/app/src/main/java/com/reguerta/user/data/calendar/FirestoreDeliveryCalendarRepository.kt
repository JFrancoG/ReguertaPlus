package com.reguerta.user.data.calendar

import com.google.android.gms.tasks.Tasks
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.reguerta.user.data.firestore.ReguertaFirestoreCollection
import com.reguerta.user.data.firestore.ReguertaFirestoreDocument
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.firestore.ReguertaFirestorePath
import com.reguerta.user.data.firestore.ReguertaRuntimeEnvironment
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

    private val globalConfigDocumentPath: String
        get() = firestorePath.documentPath(
            collection = ReguertaFirestoreCollection.CONFIG,
            documentId = ReguertaFirestoreDocument.GLOBAL.wireValue,
        )

    private val legacyEnvironmentPrefix: String
        get() = (environment ?: ReguertaRuntimeEnvironment.currentFirestoreEnvironment()).wireValue

    override suspend fun getDefaultDeliveryDayOfWeek(): DeliveryWeekday? = withContext(Dispatchers.IO) {
        val candidatePaths = listOf(
            globalConfigDocumentPath,
            "$legacyEnvironmentPrefix/collections/config/${ReguertaFirestoreDocument.GLOBAL.wireValue}",
            "$legacyEnvironmentPrefix/config/${ReguertaFirestoreDocument.GLOBAL.wireValue}",
            "config/${ReguertaFirestoreDocument.GLOBAL.wireValue}",
        ).distinct()

        candidatePaths.asSequence().mapNotNull { path ->
            runCatching {
                val snapshot = Tasks.await(firestore.document(path).get())
                resolveDeliveryWeekday(snapshot.getData() ?: emptyMap())
            }.getOrNull()
        }.firstOrNull()
    }

    override suspend fun getAllOverrides(): List<DeliveryCalendarOverride> = withContext(Dispatchers.IO) {
        val candidatePaths = listOf(
            calendarCollectionPath,
            "$legacyEnvironmentPrefix/collections/deliveryCalendar",
            "$legacyEnvironmentPrefix/deliveryCalendar",
            "deliveryCalendar",
        ).distinct()

        candidatePaths.asSequence().mapNotNull { path ->
            runCatching {
                val snapshot = Tasks.await(firestore.collection(path).get())
                snapshot.documents.mapNotNull { document ->
                    val weekKey = document.getString("weekKey")?.trim()?.ifBlank { document.id } ?: document.id
                    val deliveryDate = document.getTimestamp("deliveryDate")?.toDate()?.time ?: return@mapNotNull null
                    val ordersBlockedDate = document.getTimestamp("ordersBlockedDate")?.toDate()?.time
                        ?: (deliveryDate + 24L * 60L * 60L * 1_000L)
                    val ordersOpenAt = document.getTimestamp("ordersOpenAt")?.toDate()?.time
                        ?: ordersBlockedDate
                    val ordersCloseAt = document.getTimestamp("ordersCloseAt")?.toDate()?.time
                        ?: (ordersBlockedDate + 24L * 60L * 60L * 1_000L)
                    val updatedBy = document.getString("updatedBy")?.trim().orEmpty()
                    val updatedAt = document.getTimestamp("updatedAt")?.toDate()?.time ?: 0L
                    DeliveryCalendarOverride(
                        weekKey = weekKey,
                        deliveryDateMillis = deliveryDate,
                        ordersBlockedDateMillis = ordersBlockedDate,
                        ordersOpenAtMillis = ordersOpenAt,
                        ordersCloseAtMillis = ordersCloseAt,
                        updatedBy = updatedBy,
                        updatedAtMillis = updatedAt,
                    )
                }.sortedBy { it.weekKey }
            }.getOrNull()?.takeIf { it.isNotEmpty() }
        }.firstOrNull() ?: emptyList()
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
        Tasks.await(
            firestore.document("$calendarCollectionPath/${override.weekKey}").set(payload),
        )
        override
    }

    override suspend fun deleteOverride(weekKey: String) {
        withContext(Dispatchers.IO) {
            Tasks.await(
                firestore.document("$calendarCollectionPath/$weekKey").delete(),
            )
        }
    }
}

private fun resolveDeliveryWeekday(data: Map<String, Any>): DeliveryWeekday? {
    val topLevel = DeliveryWeekday.fromWireValue(data["deliveryDayOfWeek"] as? String)
        ?: DeliveryWeekday.fromWireValue(data["deliveryDateOfWeek"] as? String)
    if (topLevel != null) return topLevel
    val otherConfig = data["otherConfig"] as? Map<*, *> ?: return null
    return DeliveryWeekday.fromWireValue(otherConfig["deliveryDayOfWeek"] as? String)
        ?: DeliveryWeekday.fromWireValue(otherConfig["deliveryDateOfWeek"] as? String)
}
