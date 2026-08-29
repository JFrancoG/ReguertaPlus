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
import com.reguerta.user.domain.shifts.ShiftPlanningCandidate
import com.reguerta.user.domain.shifts.ShiftPlanningCandidateReference
import com.reguerta.user.domain.shifts.ShiftPlanningInspectionRepository
import com.reguerta.user.domain.shifts.ShiftPlanningRequest
import com.reguerta.user.domain.shifts.ShiftPlanningRequestObservation
import com.reguerta.user.domain.shifts.ShiftPlanningRequestRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.withContext

class FirestoreShiftPlanningRequestRepository internal constructor(
    private val firestore: FirebaseFirestore,
    private val contextClient: FirebaseShiftPlanningRequestContextClient,
    private val environment: ReguertaFirestoreEnvironment? = null,
) : ShiftPlanningRequestRepository, ShiftPlanningInspectionRepository {
    private val firestorePath = ReguertaFirestorePath(environment = environment)

    private val requestsCollectionPath: String
        get() = firestorePath.collectionPath(ReguertaFirestoreCollection.SHIFT_PLANNING_REQUESTS)

    private val candidatesCollectionPath: String
        get() = firestorePath.collectionPath(ReguertaFirestoreCollection.SHIFT_PLANNING_CANDIDATES)

    override fun observeLatestRequest(): Flow<ShiftPlanningRequestObservation?> = callbackFlow {
        val registration = firestore.collection(requestsCollectionPath)
            .orderBy("requestedAt", com.google.firebase.firestore.Query.Direction.DESCENDING)
            .limit(25)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error.toShiftPlanningRepositoryException("shiftPlanningRequests.read"))
                    return@addSnapshotListener
                }
                try {
                    val observation = snapshot?.documents
                        ?.asSequence()
                        ?.mapNotNull { document ->
                            decodeShiftPlanningObservation(
                                documentId = document.id,
                                data = document.data ?: emptyMap(),
                            )
                        }
                        ?.firstOrNull()
                    trySend(observation).getOrThrow()
                } catch (failure: Exception) {
                    close(failure.toShiftPlanningRepositoryException("shiftPlanningRequests.read"))
                }
            }
        awaitClose { registration.remove() }
    }

    override suspend fun getStagedCandidate(
        reference: ShiftPlanningCandidateReference,
    ): ShiftPlanningCandidate = withContext(Dispatchers.IO) {
        try {
            val document = firestore.collection(candidatesCollectionPath).document(reference.candidateId)
            val header = Tasks.await(document.get())
            val positions = Tasks.await(document.collection("positions").get())
            decodeShiftPlanningCandidate(
                documentId = header.id,
                data = header.data ?: emptyMap(),
                positionDocuments = positions.documents.map { it.id to (it.data ?: emptyMap()) },
                reference = reference,
            )
        } catch (error: Exception) {
            throw error.toShiftPlanningRepositoryException("shiftPlanningCandidates.read")
        }
    }

    override suspend fun submitShiftPlanningRequest(request: ShiftPlanningRequest): ShiftPlanningRequest =
        withContext(Dispatchers.IO) {
            try {
                val resolved = resolveShiftPlanningRequest(request, contextClient.resolve())
                Tasks.await(
                    firestore.runTransaction { transaction ->
                        val document = firestore.collection(requestsCollectionPath).document(resolved.request.id)
                        val snapshot = transaction.get(document)
                        when (
                            resolveShiftPlanningPersistence(
                                documentExists = snapshot.exists(),
                                documentId = document.id,
                                data = snapshot.data ?: emptyMap(),
                                expected = resolved,
                            )
                        ) {
                            ShiftPlanningPersistenceResolution.Create -> {
                                transaction.set(document, resolved.firestorePayload())
                                resolved.request
                            }

                            ShiftPlanningPersistenceResolution.AcknowledgeExisting -> resolved.request
                        }
                    },
                )
            } catch (error: Exception) {
                throw error.toShiftPlanningRepositoryException("shiftPlanningRequests.write")
            }
        }
}

internal data class ResolvedShiftPlanningRequest(
    val request: ShiftPlanningRequest,
    val context: ShiftPlanningRequestContext,
)

internal enum class ShiftPlanningPersistenceResolution {
    Create,
    AcknowledgeExisting,
}

internal fun resolveShiftPlanningRequest(
    request: ShiftPlanningRequest,
    context: ShiftPlanningRequestContext,
): ResolvedShiftPlanningRequest {
    if (
        !PLANNING_IDENTIFIER.matches(request.id.trim()) ||
        !PLANNING_IDENTIFIER.matches(request.bundleId.trim()) ||
        !PLANNING_IDENTIFIER.matches(request.requestedByUserId.trim()) ||
        request.requestedAtMillis < 0 ||
        request.deliveryTargetSeasonStartYear !in VALID_SEASON_RANGE ||
        request.marketTargetSeasonStartYear !in VALID_SEASON_RANGE ||
        context.environment !in VALID_ENVIRONMENTS ||
        context.expectedWriteEpoch < 0 ||
        context.expectedActiveRevision?.let { !PLANNING_IDENTIFIER.matches(it) } == true
    ) {
        invalidShiftPlanningRequest()
    }
    return ResolvedShiftPlanningRequest(
        request = request.copy(
            id = request.id.trim(),
            bundleId = request.bundleId.trim(),
            requestedByUserId = request.requestedByUserId.trim(),
        ),
        context = context,
    )
}

internal fun ResolvedShiftPlanningRequest.firestorePayload(): Map<String, Any?> = mapOf(
    "schemaVersion" to 2,
    "requestId" to request.id,
    "bundleId" to request.bundleId,
    "environment" to context.environment,
    "requestedByUserId" to request.requestedByUserId,
    "requestedAt" to Timestamp(
        request.requestedAtMillis / 1_000,
        ((request.requestedAtMillis % 1_000) * 1_000_000).toInt(),
    ),
    "mode" to "preview",
    "status" to "requested",
    "expectedWriteEpoch" to context.expectedWriteEpoch,
    "expectedActiveRevision" to context.expectedActiveRevision,
    "subplans" to mapOf(
        "delivery" to mapOf("targetSeasonStartYear" to request.deliveryTargetSeasonStartYear),
        "market" to mapOf("targetSeasonStartYear" to request.marketTargetSeasonStartYear),
    ),
    "binding" to null,
)

internal fun resolveShiftPlanningPersistence(
    documentExists: Boolean,
    documentId: String,
    data: Map<String, Any?>,
    expected: ResolvedShiftPlanningRequest,
): ShiftPlanningPersistenceResolution {
    val request = expected.request
    if (request.id != documentId) invalidShiftPlanningRequest()
    if (!documentExists) return ShiftPlanningPersistenceResolution.Create

    val status = data.requiredString("status")
    val subplans = data.requiredMap("subplans")
    if (
        data.requiredLong("schemaVersion") != 2L ||
        data.requiredString("requestId") != request.id ||
        data.requiredString("bundleId") != request.bundleId ||
        data.requiredString("environment") != expected.context.environment ||
        data.requiredString("requestedByUserId") != request.requestedByUserId ||
        data.requiredTimestampMillis("requestedAt") != request.requestedAtMillis ||
        data.requiredString("mode") != "preview" ||
        status !in VALID_STATUSES ||
        data["binding"] != null ||
        subplans.requiredTargetSeason("delivery") != request.deliveryTargetSeasonStartYear ||
        subplans.requiredTargetSeason("market") != request.marketTargetSeasonStartYear
    ) {
        invalidShiftPlanningRequest()
    }
    return ShiftPlanningPersistenceResolution.AcknowledgeExisting
}

private fun Map<String, Any?>.requiredString(field: String): String =
    (this[field] as? String)?.trim()?.takeIf(String::isNotEmpty) ?: invalidShiftPlanningRequest()

private fun Map<String, Any?>.requiredLong(field: String): Long =
    (this[field] as? Number)?.toLong() ?: invalidShiftPlanningRequest()

private fun Map<String, Any?>.requiredTimestampMillis(field: String): Long =
    (this[field] as? Timestamp)?.toDate()?.time ?: invalidShiftPlanningRequest()

@Suppress("UNCHECKED_CAST")
private fun Map<String, Any?>.requiredMap(field: String): Map<String, Any?> =
    this[field] as? Map<String, Any?> ?: invalidShiftPlanningRequest()

private fun Map<String, Any?>.requiredTargetSeason(type: String): Int {
    val subplan = requiredMap(type)
    if (subplan.keys != setOf("targetSeasonStartYear")) invalidShiftPlanningRequest()
    val year = subplan.requiredLong("targetSeasonStartYear")
    return year.toInt().takeIf { year == it.toLong() && it in VALID_SEASON_RANGE }
        ?: invalidShiftPlanningRequest()
}

private fun invalidShiftPlanningRequest(): Nothing = throw RepositoryException(
    kind = RepositoryErrorKind.INVALID_DATA,
    resource = "shiftPlanningRequests.document",
)

private fun Throwable.toShiftPlanningRepositoryException(resource: String): Throwable {
    var current: Throwable? = this
    while (current != null) {
        if (current is RepositoryException) return current
        current = current.cause
    }
    return toRepositoryException(resource = resource)
}

private val VALID_ENVIRONMENTS = setOf("develop", "production")
private val VALID_STATUSES = setOf("requested", "processing", "completed", "failed")
private val VALID_SEASON_RANGE = 2000..9998
private val PLANNING_IDENTIFIER = Regex("^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
