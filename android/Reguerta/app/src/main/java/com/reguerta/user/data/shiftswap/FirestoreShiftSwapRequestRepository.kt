package com.reguerta.user.data.shiftswap

import com.google.android.gms.tasks.Tasks
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Source
import com.reguerta.user.data.firestore.ReguertaFirestoreCollection
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.firestore.ReguertaFirestorePath
import com.reguerta.user.data.firestore.toRepositoryException
import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import com.reguerta.user.domain.shifts.ShiftSwapRequest
import com.reguerta.user.domain.shifts.ShiftSwapCandidate
import com.reguerta.user.domain.shifts.ShiftSwapRequestRepository
import com.reguerta.user.domain.shifts.ShiftSwapRequestStatus
import com.reguerta.user.domain.shifts.ShiftSwapResponse
import com.reguerta.user.domain.shifts.ShiftSwapResponseStatus
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

internal class FirestoreShiftSwapRequestRepository(
    private val firestore: FirebaseFirestore,
    private val transitionClient: FirebaseShiftSwapTransitionClient,
    private val environment: ReguertaFirestoreEnvironment? = null,
) : ShiftSwapRequestRepository {
    private val firestorePath = ReguertaFirestorePath(environment = environment)

    private val requestsCollectionPath: String
        get() = firestorePath.collectionPath(ReguertaFirestoreCollection.SHIFT_SWAP_REQUESTS)

    override suspend fun getAllShiftSwapRequests(): List<ShiftSwapRequest> = withContext(Dispatchers.IO) {
        try {
            val snapshot = Tasks.await(
                firestore.collection(requestsCollectionPath).get(Source.SERVER),
            )
            decodeShiftSwapRequestDocuments(
                snapshot.documents.map { document ->
                    document.id to (document.data ?: invalidShiftSwapRequestDocument())
                },
            )
        } catch (error: Exception) {
            throw error.toRepositoryException(resource = "shiftSwapRequests")
        }
    }

    override suspend fun createShiftSwapRequest(requestedShiftId: String, reason: String): String =
        try {
            transitionClient.create(requestedShiftId = requestedShiftId, reason = reason)
        } catch (error: Exception) {
            throw error.toRepositoryException(resource = "shiftSwapRequests.transition")
        }

    override suspend fun respondToShiftSwapRequest(
        requestId: String,
        candidateShiftId: String,
        response: ShiftSwapResponseStatus,
    ) {
        try {
            transitionClient.respond(
                requestId = requestId,
                candidateShiftId = candidateShiftId,
                response = response,
            )
        } catch (error: Exception) {
            throw error.toRepositoryException(resource = "shiftSwapRequests.transition")
        }
    }

    override suspend fun cancelShiftSwapRequest(requestId: String) {
        try {
            transitionClient.cancel(requestId)
        } catch (error: Exception) {
            throw error.toRepositoryException(resource = "shiftSwapRequests.transition")
        }
    }

    override suspend fun applyShiftSwapRequest(requestId: String, candidateShiftId: String) {
        try {
            transitionClient.apply(requestId = requestId, candidateShiftId = candidateShiftId)
        } catch (error: Exception) {
            throw error.toRepositoryException(resource = "shiftSwapRequests.transition")
        }
    }
}

internal fun decodeShiftSwapRequestDocuments(
    documents: List<Pair<String, Map<String, Any?>>>,
): List<ShiftSwapRequest> = documents
    .map { (documentId, data) -> decodeShiftSwapRequestDocument(documentId, data) }
    .sortedByDescending { it.requestedAtMillis }

private fun decodeShiftSwapRequestDocument(
    documentId: String,
    data: Map<String, Any?>,
): ShiftSwapRequest {
    val requestedShiftId = data.requiredString("requestedShiftId")
    val requesterUserId = data.requiredString("requesterUserId")
    val reason = data.requiredPossiblyEmptyString("reason")
    val status = data.requiredString("status").lowercase().toShiftSwapRequestStatus()
        ?: invalidShiftSwapRequestDocument()
    val requestedAtMillis = data.requiredTimestampMillis("requestedAt")
    val candidates = data.requiredObjectList("candidates").map { candidate ->
        ShiftSwapCandidate(
            userId = candidate.requiredString("userId"),
            shiftId = candidate.requiredString("shiftId"),
        )
    }
    val responses = data.requiredObjectList("responses").map { response ->
        val responseStatus = response.requiredString("status").lowercase().toShiftSwapResponseStatus()
            ?: invalidShiftSwapRequestDocument()
        ShiftSwapResponse(
            userId = response.requiredString("userId"),
            shiftId = response.requiredString("shiftId"),
            status = responseStatus,
            respondedAtMillis = response.requiredTimestampMillis("respondedAt"),
        )
    }
    return ShiftSwapRequest(
        id = documentId,
        requestedShiftId = requestedShiftId,
        requesterUserId = requesterUserId,
        reason = reason,
        status = status,
        candidates = candidates,
        responses = responses,
        selectedCandidateUserId = data.optionalString("selectedCandidateUserId"),
        selectedCandidateShiftId = data.optionalString("selectedCandidateShiftId"),
        requestedAtMillis = requestedAtMillis,
        confirmedAtMillis = data.optionalTimestampMillis("confirmedAt"),
        appliedAtMillis = data.optionalTimestampMillis("appliedAt"),
    )
}

private fun Map<String, Any?>.requiredString(field: String): String =
    optionalString(field) ?: invalidShiftSwapRequestDocument()

private fun Map<String, Any?>.requiredPossiblyEmptyString(field: String): String {
    if (!containsKey(field)) invalidShiftSwapRequestDocument()
    return (this[field] as? String)?.trim() ?: invalidShiftSwapRequestDocument()
}

private fun Map<String, Any?>.optionalString(field: String): String? {
    if (!containsKey(field) || this[field] == null) return null
    val value = this[field] as? String ?: invalidShiftSwapRequestDocument()
    return value.trim().ifBlank { null }
}

private fun Map<String, Any?>.requiredObjectList(field: String): List<Map<String, Any?>> {
    val values = this[field] as? List<*> ?: invalidShiftSwapRequestDocument()
    return values.map { value -> value.toStringKeyedMap() }
}

private fun Any?.toStringKeyedMap(): Map<String, Any?> {
    val raw = this as? Map<*, *> ?: invalidShiftSwapRequestDocument()
    return raw.entries.associate { (key, value) ->
        (key as? String ?: invalidShiftSwapRequestDocument()) to value
    }
}

private fun Map<String, Any?>.requiredTimestampMillis(field: String): Long =
    optionalTimestampMillis(field) ?: invalidShiftSwapRequestDocument()

private fun Map<String, Any?>.optionalTimestampMillis(field: String): Long? {
    if (!containsKey(field) || this[field] == null) return null
    return (this[field] as? Timestamp)?.toDate()?.time ?: invalidShiftSwapRequestDocument()
}

private fun invalidShiftSwapRequestDocument(): Nothing = throw RepositoryException(
    kind = RepositoryErrorKind.INVALID_DATA,
    resource = "shiftSwapRequests.document",
)

private fun String.toShiftSwapRequestStatus(): ShiftSwapRequestStatus? = when (this) {
    "open" -> ShiftSwapRequestStatus.OPEN
    "cancelled" -> ShiftSwapRequestStatus.CANCELLED
    "applied" -> ShiftSwapRequestStatus.APPLIED
    else -> null
}

private fun String.toShiftSwapResponseStatus(): ShiftSwapResponseStatus? = when (this) {
    "available" -> ShiftSwapResponseStatus.AVAILABLE
    "unavailable" -> ShiftSwapResponseStatus.UNAVAILABLE
    else -> null
}
