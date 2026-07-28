package com.reguerta.user.data.shifts

import com.google.android.gms.tasks.Tasks
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.google.firebase.firestore.Source
import com.reguerta.user.data.firestore.ReguertaFirestoreCollection
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.firestore.ReguertaFirestorePath
import com.reguerta.user.data.firestore.toRepositoryException
import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.domain.shifts.ShiftRepository
import com.reguerta.user.domain.shifts.ShiftStatus
import com.reguerta.user.domain.shifts.ShiftType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class FirestoreShiftRepository(
    private val firestore: FirebaseFirestore,
    private val environment: ReguertaFirestoreEnvironment? = null,
) : ShiftRepository {
    private val firestorePath = ReguertaFirestorePath(environment = environment)

    private val shiftsCollectionPath: String
        get() = firestorePath.collectionPath(ReguertaFirestoreCollection.SHIFTS)

    override suspend fun getAllShifts(): List<ShiftAssignment> = withContext(Dispatchers.IO) {
        try {
            val snapshot = Tasks.await(
                firestore.collection(shiftsCollectionPath).get(Source.SERVER),
            )
            decodeShiftDocuments(
                snapshot.documents.map { document ->
                    document.id to (document.data ?: invalidShiftDocument())
                },
            )
        } catch (error: Exception) {
            throw error.toRepositoryException(resource = "shifts")
        }
    }

    override suspend fun upsertShift(shift: ShiftAssignment): ShiftAssignment = withContext(Dispatchers.IO) {
        val payload = mapOf(
            "type" to shift.type.wireValue(),
            "date" to Timestamp(shift.dateMillis / 1_000, ((shift.dateMillis % 1_000) * 1_000_000).toInt()),
            "assignedUserIds" to shift.assignedUserIds,
            "helperUserId" to shift.helperUserId,
            "status" to shift.status.wireValue(),
            "source" to shift.source,
            "createdAt" to Timestamp(shift.createdAtMillis / 1_000, ((shift.createdAtMillis % 1_000) * 1_000_000).toInt()),
            "updatedAt" to Timestamp(shift.updatedAtMillis / 1_000, ((shift.updatedAtMillis % 1_000) * 1_000_000).toInt()),
        )
        try {
            Tasks.await(
                firestore.collection(shiftsCollectionPath)
                    .document(shift.id)
                    .set(payload, SetOptions.merge()),
            )
            shift
        } catch (error: Exception) {
            throw error.toRepositoryException(resource = "shifts.write")
        }
    }
}

internal fun decodeShiftDocuments(
    documents: List<Pair<String, Map<String, Any?>>>,
): List<ShiftAssignment> = documents
    .map { (documentId, data) -> decodeShiftDocument(documentId, data) }
    .sortedBy { it.dateMillis }

private fun decodeShiftDocument(documentId: String, data: Map<String, Any?>): ShiftAssignment {
    val type = when (data.requiredString("type").lowercase()) {
        "delivery" -> ShiftType.DELIVERY
        "market" -> ShiftType.MARKET
        else -> invalidShiftDocument()
    }
    val status = when (data.requiredString("status").lowercase()) {
        "planned" -> ShiftStatus.PLANNED
        "swap_pending" -> ShiftStatus.SWAP_PENDING
        "confirmed" -> ShiftStatus.CONFIRMED
        else -> invalidShiftDocument()
    }
    val dateMillis = data.requiredTimestampMillis("date")
    val assignedUserIds = data.requiredStringList("assignedUserIds")
    val source = data.requiredString("source").takeIf { it in validShiftSources }
        ?: invalidShiftDocument()

    return ShiftAssignment(
        id = documentId,
        type = type,
        dateMillis = dateMillis,
        assignedUserIds = assignedUserIds,
        helperUserId = data.optionalString("helperUserId"),
        status = status,
        source = source,
        createdAtMillis = data.requiredTimestampMillis("createdAt"),
        updatedAtMillis = data.requiredTimestampMillis("updatedAt"),
    )
}

private fun Map<String, Any?>.requiredString(field: String): String =
    optionalString(field) ?: invalidShiftDocument()

private fun Map<String, Any?>.optionalString(field: String): String? {
    if (!containsKey(field) || this[field] == null) return null
    val value = this[field] as? String ?: invalidShiftDocument()
    return value.trim().ifBlank { null }
}

private fun Map<String, Any?>.requiredStringList(field: String): List<String> {
    val values = this[field] as? List<*> ?: invalidShiftDocument()
    return values.map { value ->
        (value as? String)?.trim()?.takeIf(String::isNotBlank) ?: invalidShiftDocument()
    }
}

private fun Map<String, Any?>.requiredTimestampMillis(field: String): Long =
    optionalTimestampMillis(field) ?: invalidShiftDocument()

private fun Map<String, Any?>.optionalTimestampMillis(field: String): Long? {
    if (!containsKey(field) || this[field] == null) return null
    return (this[field] as? Timestamp)?.toDate()?.time ?: invalidShiftDocument()
}

private fun invalidShiftDocument(): Nothing = throw RepositoryException(
    kind = RepositoryErrorKind.INVALID_DATA,
    resource = "shifts.document",
)

private val validShiftSources = setOf("app", "google_sheets")

private fun ShiftType.wireValue(): String = when (this) {
    ShiftType.DELIVERY -> "delivery"
    ShiftType.MARKET -> "market"
}

private fun ShiftStatus.wireValue(): String = when (this) {
    ShiftStatus.PLANNED -> "planned"
    ShiftStatus.SWAP_PENDING -> "swap_pending"
    ShiftStatus.CONFIRMED -> "confirmed"
}
