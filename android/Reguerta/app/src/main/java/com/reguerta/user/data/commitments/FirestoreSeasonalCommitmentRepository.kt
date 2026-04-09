package com.reguerta.user.data.commitments

import com.google.android.gms.tasks.Tasks
import com.google.firebase.firestore.FirebaseFirestore
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

    override suspend fun getActiveCommitmentsForUser(userId: String): List<SeasonalCommitment> = withContext(Dispatchers.IO) {
        runCatching {
            val snapshot = Tasks.await(
                firestore.collection(commitmentsCollectionPath)
                    .whereEqualTo("userId", userId)
                    .whereEqualTo("active", true)
                    .get(),
            )
            snapshot.documents
                .mapNotNull { it.toSeasonalCommitment() }
                .sortedWith(compareBy<SeasonalCommitment> { it.seasonKey }.thenBy { it.productId })
        }.getOrDefault(emptyList())
    }
}

private fun com.google.firebase.firestore.DocumentSnapshot.toSeasonalCommitment(): SeasonalCommitment? {
    if (!exists()) return null
    val userId = getString("userId")?.trim()?.ifBlank { null } ?: return null
    val productId = getString("productId")?.trim()?.ifBlank { null } ?: return null
    val seasonKey = getString("seasonKey")?.trim()?.ifBlank { null } ?: return null
    val fixedQty = getDouble("fixedQtyPerOfferedWeek") ?: return null
    return SeasonalCommitment(
        id = id,
        userId = userId,
        productId = productId,
        seasonKey = seasonKey,
        fixedQtyPerOfferedWeek = fixedQty,
        active = getBoolean("active") ?: true,
        createdAtMillis = getTimestamp("createdAt")?.toDate()?.time ?: 0L,
        updatedAtMillis = getTimestamp("updatedAt")?.toDate()?.time ?: 0L,
    )
}
