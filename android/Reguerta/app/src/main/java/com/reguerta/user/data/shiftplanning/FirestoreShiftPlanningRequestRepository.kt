package com.reguerta.user.data.shiftplanning

import com.google.android.gms.tasks.Tasks
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.reguerta.user.data.firestore.ReguertaFirestoreCollection
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.firestore.ReguertaFirestorePath
import com.reguerta.user.data.firestore.toRepositoryException
import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import com.reguerta.user.domain.shifts.ShiftPlanningRequest
import com.reguerta.user.domain.shifts.ShiftPlanningRequestRepository
import com.reguerta.user.domain.shifts.ShiftPlanningRequestStatus
import com.reguerta.user.domain.shifts.ShiftPlanningRequestType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class FirestoreShiftPlanningRequestRepository(
    private val firestore: FirebaseFirestore,
    private val environment: ReguertaFirestoreEnvironment? = null,
) : ShiftPlanningRequestRepository {
    private val firestorePath = ReguertaFirestorePath(environment = environment)

    private val requestsCollectionPath: String
        get() = firestorePath.collectionPath(ReguertaFirestoreCollection.SHIFT_PLANNING_REQUESTS)

    override suspend fun submitShiftPlanningRequest(request: ShiftPlanningRequest): ShiftPlanningRequest = withContext(Dispatchers.IO) {
        val persisted = request.normalizedStableIntent()
        val payload = mapOf(
            "type" to persisted.type.wireValue(),
            "requestedByUserId" to persisted.requestedByUserId,
            "requestedAt" to Timestamp(
                persisted.requestedAtMillis / 1_000,
                ((persisted.requestedAtMillis % 1_000) * 1_000_000).toInt(),
            ),
            "status" to persisted.status.wireValue(),
        )
        try {
            Tasks.await(
                firestore.runTransaction { transaction ->
                    val document = firestore.collection(requestsCollectionPath).document(persisted.id)
                    val snapshot = transaction.get(document)
                    when (
                        val resolution = resolveShiftPlanningPersistence(
                            documentExists = snapshot.exists(),
                            data = snapshot.data ?: emptyMap(),
                            expected = persisted,
                        )
                    ) {
                        ShiftPlanningPersistenceResolution.Create -> {
                            transaction.set(document, payload)
                            persisted
                        }

                        is ShiftPlanningPersistenceResolution.AcknowledgeExisting -> resolution.request
                    }
                },
            )
        } catch (error: Exception) {
            throw error.toShiftPlanningRepositoryException()
        }
    }
}

internal sealed interface ShiftPlanningPersistenceResolution {
    data object Create : ShiftPlanningPersistenceResolution

    data class AcknowledgeExisting(
        val request: ShiftPlanningRequest,
    ) : ShiftPlanningPersistenceResolution
}

internal fun resolveShiftPlanningPersistence(
    documentExists: Boolean,
    data: Map<String, Any?>,
    expected: ShiftPlanningRequest,
): ShiftPlanningPersistenceResolution {
    if (
        expected.id.isBlank() ||
        expected.requestedByUserId.isBlank() ||
        expected.status != ShiftPlanningRequestStatus.REQUESTED
    ) {
        invalidShiftPlanningRequest()
    }
    if (!documentExists) return ShiftPlanningPersistenceResolution.Create

    val persistedType = when (data.requiredString("type").lowercase()) {
        "delivery" -> ShiftPlanningRequestType.DELIVERY
        "market" -> ShiftPlanningRequestType.MARKET
        else -> invalidShiftPlanningRequest()
    }
    val persistedRequester = data.requiredString("requestedByUserId")
    val persistedRequestedAt = data.requiredTimestampMillis("requestedAt")
    val persistedStatus = when (data.requiredString("status").lowercase()) {
        "requested" -> ShiftPlanningRequestStatus.REQUESTED
        "processing" -> ShiftPlanningRequestStatus.PROCESSING
        "completed" -> ShiftPlanningRequestStatus.COMPLETED
        "failed" -> ShiftPlanningRequestStatus.FAILED
        else -> invalidShiftPlanningRequest()
    }
    if (
        persistedType != expected.type ||
        persistedRequester != expected.requestedByUserId ||
        persistedRequestedAt != expected.requestedAtMillis
    ) {
        invalidShiftPlanningRequest()
    }
    return ShiftPlanningPersistenceResolution.AcknowledgeExisting(
        request = expected.copy(status = persistedStatus),
    )
}

private fun ShiftPlanningRequest.normalizedStableIntent(): ShiftPlanningRequest {
    val normalizedId = id.trim()
    val normalizedRequester = requestedByUserId.trim()
    if (
        normalizedId.isEmpty() ||
        normalizedRequester.isEmpty() ||
        status != ShiftPlanningRequestStatus.REQUESTED
    ) {
        invalidShiftPlanningRequest()
    }
    return copy(
        id = normalizedId,
        requestedByUserId = normalizedRequester,
    )
}

private fun Map<String, Any?>.requiredString(field: String): String {
    val value = this[field] as? String ?: invalidShiftPlanningRequest()
    return value.trim().takeIf(String::isNotEmpty) ?: invalidShiftPlanningRequest()
}

private fun Map<String, Any?>.requiredTimestampMillis(field: String): Long =
    (this[field] as? Timestamp)?.toDate()?.time ?: invalidShiftPlanningRequest()

private fun invalidShiftPlanningRequest(): Nothing = throw RepositoryException(
    kind = RepositoryErrorKind.INVALID_DATA,
    resource = "shiftPlanningRequests.document",
)

private fun Throwable.toShiftPlanningRepositoryException(): Throwable {
    var current: Throwable? = this
    while (current != null) {
        if (current is RepositoryException) return current
        current = current.cause
    }
    return toRepositoryException(resource = "shiftPlanningRequests.write")
}

private fun ShiftPlanningRequestType.wireValue(): String = when (this) {
    ShiftPlanningRequestType.DELIVERY -> "delivery"
    ShiftPlanningRequestType.MARKET -> "market"
}

private fun ShiftPlanningRequestStatus.wireValue(): String = when (this) {
    ShiftPlanningRequestStatus.REQUESTED -> "requested"
    ShiftPlanningRequestStatus.PROCESSING -> "processing"
    ShiftPlanningRequestStatus.COMPLETED -> "completed"
    ShiftPlanningRequestStatus.FAILED -> "failed"
}
