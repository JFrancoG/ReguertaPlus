package com.reguerta.user.data.commitments

import com.google.android.gms.tasks.Tasks
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.DocumentReference
import com.reguerta.user.data.firestore.ReguertaFirestoreCollection
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.firestore.ReguertaFirestorePath
import com.reguerta.user.domain.commitments.SeasonalCommitment
import com.reguerta.user.domain.commitments.SeasonalCommitmentRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class FirestoreSeasonalCommitmentRepository(
    private val firestore: FirebaseFirestore,
    private val environment: ReguertaFirestoreEnvironment = ReguertaFirestoreEnvironment.DEVELOP,
) : SeasonalCommitmentRepository {
    private val firestorePath = ReguertaFirestorePath(environment = environment)

    private val commitmentsCollectionPath: String
        get() = firestorePath.collectionPath(ReguertaFirestoreCollection.SEASONAL_COMMITMENTS)

    private val usersCollectionPath: String
        get() = firestorePath.collectionPath(ReguertaFirestoreCollection.USERS)

    override suspend fun getActiveCommitmentsForUser(userId: String): List<SeasonalCommitment> = withContext(Dispatchers.IO) {
        runCatching {
            val docsById = linkedMapOf<String, com.google.firebase.firestore.DocumentSnapshot>()
            listOf("userId", "memberId").forEach { field ->
                listOf(
                    userId as Any,
                    firestore.document("$usersCollectionPath/$userId"),
                ).forEach { target ->
                    val snapshot = Tasks.await(
                        firestore.collection(commitmentsCollectionPath)
                            .whereEqualTo(field, target)
                            .get(),
                    )
                    snapshot.documents.forEach { document ->
                        docsById[document.id] = document
                    }
                }
            }
            val activeSnapshot = Tasks.await(
                firestore.collection(commitmentsCollectionPath)
                    .whereEqualTo("active", true)
                    .get(),
            )
            activeSnapshot.documents.forEach { document ->
                docsById[document.id] = document
            }
            docsById.values
                .mapNotNull { it.toSeasonalCommitment() }
                .filter { commitment -> commitment.userId == userId }
                .filter(SeasonalCommitment::active)
                .sortedWith(compareBy<SeasonalCommitment> { it.seasonKey }.thenBy { it.productId })
        }.getOrDefault(emptyList())
    }
}

private fun com.google.firebase.firestore.DocumentSnapshot.toSeasonalCommitment(): SeasonalCommitment? {
    if (!exists()) return null
    val userId = (get("userId").asNormalizedId() ?: get("memberId").asNormalizedId()) ?: return null
    val productId = get("productId").asNormalizedId() ?: return null
    val seasonKey = get("seasonKey").asNormalizedId() ?: return null
    val fixedQty = get("fixedQtyPerOfferedWeek").toPositiveDoubleOrNull() ?: return null
    return SeasonalCommitment(
        id = id,
        userId = userId,
        productId = productId,
        productNameHint = get("productName").asNormalizedId()
            ?: get("productDisplayName").asNormalizedId()
            ?: get("name").asNormalizedId(),
        seasonKey = seasonKey,
        fixedQtyPerOfferedWeek = fixedQty,
        active = getBoolean("active") ?: true,
        createdAtMillis = getTimestamp("createdAt")?.toDate()?.time ?: 0L,
        updatedAtMillis = getTimestamp("updatedAt")?.toDate()?.time ?: 0L,
    )
}

private fun Any?.toPositiveDoubleOrNull(): Double? = when (this) {
    is Number -> this.toDouble()
    is String -> this.replace(",", ".").trim().toDoubleOrNull()
    else -> null
}?.takeIf { it > 0.0 }

private fun Any?.asNormalizedId(): String? = when (this) {
    is String -> this.trim().ifBlank { null }
    is DocumentReference -> this.id.trim().ifBlank { null }
    is Map<*, *> -> (this["id"] as? String)?.trim()?.ifBlank { null }
    else -> null
}
