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

private val SeasonalCommitmentUserFields = listOf(
    "userId",
    "memberId",
    "user",
    "member",
    "userRef",
    "memberRef",
    "userID",
    "memberID",
    "uid",
)
private val SeasonalCommitmentProductFields = listOf(
    "productId",
    "product",
    "productRef",
    "commonProductId",
    "itemId",
)
private val SeasonalCommitmentSeasonFields = listOf(
    "seasonKey",
    "season",
    "campaignKey",
    "commitmentSeason",
)
private val SeasonalCommitmentQtyFields = listOf(
    "fixedQtyPerOfferedWeek",
    "fixedQtyPerWeek",
    "fixedQty",
    "weeklyQty",
    "qty",
    "quantity",
)

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
            SeasonalCommitmentUserFields.forEach { field ->
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
                .filter { commitment -> commitment.userId.matchesLookupUserId(userId) }
                .filter(SeasonalCommitment::active)
                .sortedWith(compareBy<SeasonalCommitment> { it.seasonKey }.thenBy { it.productId })
        }.getOrDefault(emptyList())
    }
}

private fun com.google.firebase.firestore.DocumentSnapshot.toSeasonalCommitment(): SeasonalCommitment? {
    if (!exists()) return null
    val userId = firstNormalizedId(SeasonalCommitmentUserFields) ?: return null
    val productId = firstNormalizedId(SeasonalCommitmentProductFields) ?: return null
    val seasonKey = firstNormalizedId(SeasonalCommitmentSeasonFields) ?: return null
    val fixedQty = firstPositiveDouble(SeasonalCommitmentQtyFields) ?: return null
    return SeasonalCommitment(
        id = id,
        userId = userId,
        productId = productId,
        productNameHint = get("productName").asNormalizedText()
            ?: get("productDisplayName").asNormalizedText()
            ?: get("name").asNormalizedText(),
        seasonKey = seasonKey,
        fixedQtyPerOfferedWeek = fixedQty,
        active = getBoolean("active") ?: true,
        createdAtMillis = getTimestamp("createdAt")?.toDate()?.time ?: 0L,
        updatedAtMillis = getTimestamp("updatedAt")?.toDate()?.time ?: 0L,
    )
}

private fun com.google.firebase.firestore.DocumentSnapshot.firstNormalizedId(fields: List<String>): String? =
    fields.firstNotNullOfOrNull { field -> get(field).asNormalizedId() }

private fun com.google.firebase.firestore.DocumentSnapshot.firstPositiveDouble(fields: List<String>): Double? =
    fields.firstNotNullOfOrNull { field -> get(field).toPositiveDoubleOrNull() }

private fun Any?.toPositiveDoubleOrNull(): Double? = when (this) {
    is Number -> this.toDouble()
    is String -> this.replace(",", ".").trim().toDoubleOrNull()
    else -> null
}?.takeIf { it > 0.0 }

private fun Any?.asNormalizedId(): String? = when (this) {
    is String -> this.trim().ifBlank { null }?.let(::normalizePathLikeIdentifier)
    is DocumentReference -> this.id.trim().ifBlank { null }
    is Map<*, *> -> (
        this["id"]
            ?: this["documentId"]
            ?: this["documentID"]
            ?: this["path"]
        )
        .asNormalizedId()
    else -> null
}

private fun Any?.asNormalizedText(): String? = when (this) {
    is String -> this.trim().ifBlank { null }
    is Map<*, *> -> (
        this["name"]
            ?: this["displayName"]
            ?: this["title"]
        )
        .asNormalizedText()
    else -> null
}

private fun normalizePathLikeIdentifier(raw: String): String {
    if (!raw.contains("/")) return raw
    val trailing = raw.substringAfterLast('/').trim()
    return trailing.ifBlank { raw }
}

private fun String.matchesLookupUserId(lookup: String): Boolean {
    val normalizedCurrent = normalizePathLikeIdentifier(trim())
    val normalizedLookup = normalizePathLikeIdentifier(lookup.trim())
    return normalizedCurrent == normalizedLookup || normalizedCurrent.equals(normalizedLookup, ignoreCase = true)
}
