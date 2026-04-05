package com.reguerta.user.data.calendar

import com.google.android.gms.tasks.Tasks
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.reguerta.user.data.firestore.ReguertaFirestoreCollection
import com.reguerta.user.data.firestore.ReguertaFirestoreDocument
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.firestore.ReguertaFirestorePath
import com.reguerta.user.domain.calendar.DeliveryCalendarOverride
import com.reguerta.user.domain.calendar.DeliveryCalendarRepository
import com.reguerta.user.domain.calendar.DeliveryWeekday
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.Date

class FirestoreDeliveryCalendarRepository(
    private val firestore: FirebaseFirestore,
    private val environment: ReguertaFirestoreEnvironment = ReguertaFirestoreEnvironment.DEVELOP,
) : DeliveryCalendarRepository {
    private val firestorePath = ReguertaFirestorePath(environment = environment)

    private val calendarCollectionPath: String
        get() = firestorePath.collectionPath(ReguertaFirestoreCollection.DELIVERY_CALENDAR)

    private val globalConfigDocumentPath: String
        get() = firestorePath.documentPath(
            collection = ReguertaFirestoreCollection.CONFIG,
            documentId = ReguertaFirestoreDocument.GLOBAL.wireValue,
        )

    override suspend fun getDefaultDeliveryDayOfWeek(): DeliveryWeekday? = withContext(Dispatchers.IO) {
        runCatching {
            val snapshot = Tasks.await(
                firestore.document(globalConfigDocumentPath).get(),
            )
            val topLevel = DeliveryWeekday.fromWireValue(snapshot.getString("deliveryDayOfWeek"))
            if (topLevel != null) {
                topLevel
            } else {
                val otherConfig = snapshot.get("otherConfig") as? Map<*, *>
                DeliveryWeekday.fromWireValue(otherConfig?.get("deliveryDayOfWeek") as? String)
            }
        }.getOrNull()
    }

    override suspend fun getAllOverrides(): List<DeliveryCalendarOverride> = withContext(Dispatchers.IO) {
        runCatching {
            val snapshot = Tasks.await(
                firestore.collection(calendarCollectionPath).get(),
            )
            snapshot.documents.mapNotNull { document ->
                val weekKey = document.getString("weekKey")?.trim()?.ifBlank { document.id } ?: document.id
                val deliveryDate = document.getTimestamp("deliveryDate")?.toDate()?.time ?: return@mapNotNull null
                val ordersBlockedDate = document.getTimestamp("ordersBlockedDate")?.toDate()?.time ?: return@mapNotNull null
                val ordersOpenAt = document.getTimestamp("ordersOpenAt")?.toDate()?.time ?: return@mapNotNull null
                val ordersCloseAt = document.getTimestamp("ordersCloseAt")?.toDate()?.time ?: return@mapNotNull null
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
        }.getOrDefault(emptyList())
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
