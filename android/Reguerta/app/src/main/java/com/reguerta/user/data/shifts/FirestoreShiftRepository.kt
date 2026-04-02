package com.reguerta.user.data.shifts

import com.google.android.gms.tasks.Tasks
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.QueryDocumentSnapshot
import com.reguerta.user.data.firestore.ReguertaFirestoreCollection
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.firestore.ReguertaFirestorePath
import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.domain.shifts.ShiftRepository
import com.reguerta.user.domain.shifts.ShiftStatus
import com.reguerta.user.domain.shifts.ShiftType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class FirestoreShiftRepository(
    private val firestore: FirebaseFirestore,
    private val environment: ReguertaFirestoreEnvironment = ReguertaFirestoreEnvironment.DEVELOP,
) : ShiftRepository {
    private val firestorePath = ReguertaFirestorePath(environment = environment)

    private val shiftsCollectionPath: String
        get() = firestorePath.collectionPath(ReguertaFirestoreCollection.SHIFTS)

    override suspend fun getAllShifts(): List<ShiftAssignment> = withContext(Dispatchers.IO) {
        runCatching {
            val snapshot = Tasks.await(
                firestore.collection(shiftsCollectionPath).get(),
            )
            snapshot.documents
                .mapNotNull { document -> (document as? QueryDocumentSnapshot)?.toShiftAssignment() }
                .sortedBy { it.dateMillis }
        }.getOrDefault(emptyList())
    }
}

private fun QueryDocumentSnapshot.toShiftAssignment(): ShiftAssignment? {
    val type = getString("type")
        ?.trim()
        ?.lowercase()
        ?.let { wire ->
            when (wire) {
                "delivery" -> ShiftType.DELIVERY
                "market" -> ShiftType.MARKET
                else -> null
            }
        } ?: return null
    val status = getString("status")
        ?.trim()
        ?.lowercase()
        ?.let { wire ->
            when (wire) {
                "planned" -> ShiftStatus.PLANNED
                "swap_pending" -> ShiftStatus.SWAP_PENDING
                "confirmed" -> ShiftStatus.CONFIRMED
                else -> null
            }
        } ?: return null
    val dateMillis = getTimestamp("date")?.toDate()?.time ?: return null
    val assignedUserIds = get("assignedUserIds") as? List<*> ?: return null

    return ShiftAssignment(
        id = id,
        type = type,
        dateMillis = dateMillis,
        assignedUserIds = assignedUserIds.mapNotNull { it as? String }.filter { it.isNotBlank() },
        helperUserId = getString("helperUserId")?.trim()?.ifBlank { null },
        status = status,
        source = getString("source")?.trim().orEmpty(),
        createdAtMillis = getTimestamp("createdAt")?.toDate()?.time ?: dateMillis,
        updatedAtMillis = getTimestamp("updatedAt")?.toDate()?.time ?: dateMillis,
    )
}
