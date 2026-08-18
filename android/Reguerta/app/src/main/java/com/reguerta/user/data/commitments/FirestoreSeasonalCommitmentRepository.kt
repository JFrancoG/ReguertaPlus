package com.reguerta.user.data.commitments

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.DocumentReference
import com.google.firebase.firestore.Source
import com.reguerta.user.data.firestore.ReguertaFirestoreCollection
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.firestore.ReguertaFirestorePath
import com.reguerta.user.data.firestore.toRepositoryException
import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.commitments.SeasonalCommitment
import com.reguerta.user.domain.commitments.SeasonalCommitmentRepository
import com.reguerta.user.domain.commitments.loadActiveCommitmentsForMember
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext

private const val SeasonalCommitmentCanonicalUserField = "userId"
private val SeasonalCommitmentUserReadFields = listOf(
    SeasonalCommitmentCanonicalUserField,
    "memberId",
    "uid",
    "user",
    "member",
    "userRef",
    "memberRef",
    "userID",
    "memberID",
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
    "fixedQty",
    "fixedQtyPerOfferedWeek",
    "fixedQtyPerWeek",
    "weeklyQty",
    "qty",
    "quantity",
)

class FirestoreSeasonalCommitmentRepository(
    private val firestore: FirebaseFirestore,
    private val environment: ReguertaFirestoreEnvironment? = null,
) : SeasonalCommitmentRepository {
    private val firestorePath = ReguertaFirestorePath(environment = environment)

    private val commitmentsCollectionPath: String
        get() = firestorePath.collectionPath(ReguertaFirestoreCollection.SEASONAL_COMMITMENTS)

    override suspend fun getActiveCommitmentsForUser(userId: String): List<SeasonalCommitment> = withContext(Dispatchers.IO) {
        val normalizedLookup = userId.trim().ifBlank { return@withContext emptyList() }
        try {
            getActiveCommitments(
                lookupKey = normalizedLookup,
                serverOnly = false,
            )
        } catch (error: Exception) {
            throw error.toRepositoryException(resource = "seasonalCommitments")
        }
    }

    internal suspend fun getActiveCommitmentsForMemberFromServer(
        member: Member,
    ): List<SeasonalCommitment> = withContext(Dispatchers.IO) {
        try {
            loadActiveCommitmentsForMember(member) { lookupKey ->
                getActiveCommitments(lookupKey = lookupKey, serverOnly = true)
            }
        } catch (error: Exception) {
            throw error.toRepositoryException(resource = "seasonalCommitments.server")
        }
    }

    private suspend fun getActiveCommitments(
        lookupKey: String,
        serverOnly: Boolean,
    ): List<SeasonalCommitment> {
        val normalizedLookup = lookupKey.trim().ifBlank { return emptyList() }
        val query = firestore.collection(commitmentsCollectionPath)
            .whereEqualTo(SeasonalCommitmentCanonicalUserField, normalizedLookup)
        val snapshot = if (serverOnly) {
            query.get(Source.SERVER).await()
        } else {
            query.get().await()
        }
        return snapshot.documents
            .map { document -> document.toSeasonalCommitment() }
            .filter { commitment -> commitment.userId.matchesLookupUserId(normalizedLookup) }
            .filter(SeasonalCommitment::active)
            .sortedWith(compareBy<SeasonalCommitment> { it.seasonKey }.thenBy { it.productId })
    }
}

private fun com.google.firebase.firestore.DocumentSnapshot.toSeasonalCommitment(): SeasonalCommitment {
    if (!exists()) invalidCommitmentDocument()
    return decodeSeasonalCommitmentDocument(id, data ?: invalidCommitmentDocument())
}

internal fun decodeSeasonalCommitmentDocument(
    documentId: String,
    data: Map<String, Any?>,
): SeasonalCommitment {
    val userId = data.firstNormalizedId(SeasonalCommitmentUserReadFields) ?: invalidCommitmentDocument()
    val productId = data.firstNormalizedId(SeasonalCommitmentProductFields) ?: invalidCommitmentDocument()
    val seasonKey = data.firstNormalizedId(SeasonalCommitmentSeasonFields) ?: invalidCommitmentDocument()
    val fixedQty = data.firstPositiveDouble(SeasonalCommitmentQtyFields) ?: invalidCommitmentDocument()
    return SeasonalCommitment(
        id = documentId,
        userId = userId,
        productId = productId,
        productNameHint = data.optionalNormalizedText("productName")
            ?: data.optionalNormalizedText("productDisplayName")
            ?: data.optionalNormalizedText("name"),
        seasonKey = seasonKey,
        fixedQtyPerOfferedWeek = fixedQty,
        active = data.optionalBoolean("active", default = true),
        createdAtMillis = data.optionalTimestampMillis("createdAt"),
        updatedAtMillis = data.optionalTimestampMillis("updatedAt"),
    )
}

private fun Map<String, Any?>.firstNormalizedId(fields: List<String>): String? =
    fields.firstNotNullOfOrNull { field ->
        val value = this[field] ?: return@firstNotNullOfOrNull null
        value.asNormalizedId() ?: invalidCommitmentDocument()
    }

private fun Map<String, Any?>.firstPositiveDouble(fields: List<String>): Double? =
    fields.firstNotNullOfOrNull { field ->
        val value = this[field] ?: return@firstNotNullOfOrNull null
        value.toPositiveDoubleOrNull() ?: invalidCommitmentDocument()
    }

private fun Any?.toPositiveDoubleOrNull(): Double? = when (this) {
    is Number -> this.toDouble()
    is String -> this.replace(",", ".").trim().toDoubleOrNull()
    else -> null
}?.takeIf { it > 0.0 }
    ?.takeIf(Double::isFinite)

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

private fun Map<String, Any?>.optionalNormalizedText(field: String): String? {
    val value = this[field] ?: return null
    return value.asNormalizedText() ?: invalidCommitmentDocument()
}

private fun Map<String, Any?>.optionalBoolean(field: String, default: Boolean): Boolean {
    val value = this[field] ?: return default
    if (value !is Boolean) invalidCommitmentDocument()
    return value
}

private fun Map<String, Any?>.optionalTimestampMillis(field: String): Long {
    val value = this[field] ?: return 0L
    if (value !is com.google.firebase.Timestamp) invalidCommitmentDocument()
    return value.toDate().time
}

private fun invalidCommitmentDocument(): Nothing = throw RepositoryException(
    kind = RepositoryErrorKind.INVALID_DATA,
    resource = "seasonalCommitments.document",
)

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
