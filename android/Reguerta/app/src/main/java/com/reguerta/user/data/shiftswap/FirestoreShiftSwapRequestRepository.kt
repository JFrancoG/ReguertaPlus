package com.reguerta.user.data.shiftswap

import com.google.android.gms.tasks.Tasks
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.QueryDocumentSnapshot
import com.google.firebase.firestore.SetOptions
import com.reguerta.user.data.firestore.ReguertaFirestoreCollection
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.firestore.ReguertaFirestorePath
import com.reguerta.user.domain.shifts.ShiftSwapRequest
import com.reguerta.user.domain.shifts.ShiftSwapCandidate
import com.reguerta.user.domain.shifts.ShiftSwapRequestRepository
import com.reguerta.user.domain.shifts.ShiftSwapRequestStatus
import com.reguerta.user.domain.shifts.ShiftSwapResponse
import com.reguerta.user.domain.shifts.ShiftSwapResponseStatus
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class FirestoreShiftSwapRequestRepository(
    private val firestore: FirebaseFirestore,
    private val environment: ReguertaFirestoreEnvironment? = null,
) : ShiftSwapRequestRepository {
    private val firestorePath = ReguertaFirestorePath(environment = environment)

    private val requestsCollectionPath: String
        get() = firestorePath.collectionPath(ReguertaFirestoreCollection.SHIFT_SWAP_REQUESTS)

    override suspend fun getAllShiftSwapRequests(): List<ShiftSwapRequest> = withContext(Dispatchers.IO) {
        runCatching {
            val snapshot = Tasks.await(
                firestore.collection(requestsCollectionPath).get(),
            )
            snapshot.documents
                .mapNotNull { document -> (document as? QueryDocumentSnapshot)?.toShiftSwapRequest() }
                .sortedByDescending { it.requestedAtMillis }
        }.getOrDefault(emptyList())
    }

    override suspend fun upsertShiftSwapRequest(request: ShiftSwapRequest): ShiftSwapRequest = withContext(Dispatchers.IO) {
        val documentId = request.id.ifBlank {
            firestore.collection(requestsCollectionPath).document().id
        }
        val persisted = request.copy(id = documentId)
        val payload = mutableMapOf<String, Any?>(
            "requestedShiftId" to persisted.requestedShiftId,
            "requesterUserId" to persisted.requesterUserId,
            "reason" to persisted.reason,
            "status" to persisted.status.wireValue(),
            "candidates" to persisted.candidates.map { candidate ->
                mapOf(
                    "userId" to candidate.userId,
                    "shiftId" to candidate.shiftId,
                )
            },
            "responses" to persisted.responses.map { response ->
                mapOf(
                    "userId" to response.userId,
                    "shiftId" to response.shiftId,
                    "status" to response.status.wireValue(),
                    "respondedAt" to Timestamp(
                        response.respondedAtMillis / 1_000,
                        ((response.respondedAtMillis % 1_000) * 1_000_000).toInt(),
                    ),
                )
            },
            "selectedCandidateUserId" to persisted.selectedCandidateUserId,
            "selectedCandidateShiftId" to persisted.selectedCandidateShiftId,
            "requestedAt" to Timestamp(persisted.requestedAtMillis / 1_000, ((persisted.requestedAtMillis % 1_000) * 1_000_000).toInt()),
            "confirmedAt" to persisted.confirmedAtMillis?.let { Timestamp(it / 1_000, ((it % 1_000) * 1_000_000).toInt()) },
            "appliedAt" to persisted.appliedAtMillis?.let { Timestamp(it / 1_000, ((it % 1_000) * 1_000_000).toInt()) },
        )
        runCatching {
            Tasks.await(
                firestore.collection(requestsCollectionPath)
                    .document(documentId)
                    .set(payload, SetOptions.merge()),
            )
            persisted
        }.getOrDefault(persisted)
    }
}

private fun QueryDocumentSnapshot.toShiftSwapRequest(): ShiftSwapRequest? {
    val requestedShiftId = getString("requestedShiftId")?.trim().orEmpty()
    val requesterUserId = getString("requesterUserId")?.trim().orEmpty()
    val reason = getString("reason")?.trim().orEmpty()
    val status = getString("status")?.trim()?.lowercase()?.toShiftSwapRequestStatus() ?: return null
    val requestedAtMillis = getTimestamp("requestedAt")?.toDate()?.time ?: return null
    if (requestedShiftId.isBlank() || requesterUserId.isBlank()) {
        return null
    }
    val candidates = (get("candidates") as? List<*>)
        ?.mapNotNull { raw ->
            val map = raw as? Map<*, *> ?: return@mapNotNull null
            val userId = (map["userId"] as? String)?.trim().orEmpty()
            val shiftId = (map["shiftId"] as? String)?.trim().orEmpty()
            if (userId.isBlank() || shiftId.isBlank()) null else ShiftSwapCandidate(userId = userId, shiftId = shiftId)
        }
        .orEmpty()
    val responses = (get("responses") as? List<*>)
        ?.mapNotNull { raw ->
            val map = raw as? Map<*, *> ?: return@mapNotNull null
            val userId = (map["userId"] as? String)?.trim().orEmpty()
            val shiftId = (map["shiftId"] as? String)?.trim().orEmpty()
            val responseStatus = (map["status"] as? String)?.trim()?.lowercase()?.toShiftSwapResponseStatus() ?: return@mapNotNull null
            val respondedAtMillis = (map["respondedAt"] as? Timestamp)?.toDate()?.time ?: return@mapNotNull null
            if (userId.isBlank() || shiftId.isBlank()) {
                null
            } else {
                ShiftSwapResponse(
                    userId = userId,
                    shiftId = shiftId,
                    status = responseStatus,
                    respondedAtMillis = respondedAtMillis,
                )
            }
        }
        .orEmpty()
    return ShiftSwapRequest(
        id = id,
        requestedShiftId = requestedShiftId,
        requesterUserId = requesterUserId,
        reason = reason,
        status = status,
        candidates = candidates,
        responses = responses,
        selectedCandidateUserId = getString("selectedCandidateUserId")?.trim()?.ifBlank { null },
        selectedCandidateShiftId = getString("selectedCandidateShiftId")?.trim()?.ifBlank { null },
        requestedAtMillis = requestedAtMillis,
        confirmedAtMillis = getTimestamp("confirmedAt")?.toDate()?.time,
        appliedAtMillis = getTimestamp("appliedAt")?.toDate()?.time,
    )
}

private fun String.toShiftSwapRequestStatus(): ShiftSwapRequestStatus? = when (this) {
    "open" -> ShiftSwapRequestStatus.OPEN
    "cancelled" -> ShiftSwapRequestStatus.CANCELLED
    "applied" -> ShiftSwapRequestStatus.APPLIED
    else -> null
}

private fun ShiftSwapRequestStatus.wireValue(): String = when (this) {
    ShiftSwapRequestStatus.OPEN -> "open"
    ShiftSwapRequestStatus.CANCELLED -> "cancelled"
    ShiftSwapRequestStatus.APPLIED -> "applied"
}

private fun String.toShiftSwapResponseStatus(): ShiftSwapResponseStatus? = when (this) {
    "available" -> ShiftSwapResponseStatus.AVAILABLE
    "unavailable" -> ShiftSwapResponseStatus.UNAVAILABLE
    else -> null
}

private fun ShiftSwapResponseStatus.wireValue(): String = when (this) {
    ShiftSwapResponseStatus.AVAILABLE -> "available"
    ShiftSwapResponseStatus.UNAVAILABLE -> "unavailable"
}
