package com.reguerta.user.data.shiftplanning

import com.google.android.gms.tasks.Tasks
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.reguerta.user.data.firestore.ReguertaFirestoreCollection
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.firestore.ReguertaFirestorePath
import com.reguerta.user.domain.shifts.ShiftPlanningRequest
import com.reguerta.user.domain.shifts.ShiftPlanningRequestRepository
import com.reguerta.user.domain.shifts.ShiftPlanningRequestStatus
import com.reguerta.user.domain.shifts.ShiftPlanningRequestType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class FirestoreShiftPlanningRequestRepository(
    private val firestore: FirebaseFirestore,
    private val environment: ReguertaFirestoreEnvironment = ReguertaFirestoreEnvironment.DEVELOP,
) : ShiftPlanningRequestRepository {
    private val firestorePath = ReguertaFirestorePath(environment = environment)

    private val requestsCollectionPath: String
        get() = firestorePath.collectionPath(ReguertaFirestoreCollection.SHIFT_PLANNING_REQUESTS)

    override suspend fun submitShiftPlanningRequest(request: ShiftPlanningRequest): ShiftPlanningRequest = withContext(Dispatchers.IO) {
        val documentId = request.id.ifBlank {
            firestore.collection(requestsCollectionPath).document().id
        }
        val persisted = request.copy(id = documentId)
        val payload = mapOf(
            "type" to persisted.type.wireValue(),
            "requestedByUserId" to persisted.requestedByUserId,
            "requestedAt" to Timestamp(
                persisted.requestedAtMillis / 1_000,
                ((persisted.requestedAtMillis % 1_000) * 1_000_000).toInt(),
            ),
            "status" to persisted.status.wireValue(),
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
