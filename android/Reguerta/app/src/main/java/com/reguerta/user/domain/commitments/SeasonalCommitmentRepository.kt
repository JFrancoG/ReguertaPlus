package com.reguerta.user.domain.commitments

import com.reguerta.user.domain.access.Member

interface SeasonalCommitmentRepository {
    suspend fun getActiveCommitmentsForUser(userId: String): List<SeasonalCommitment>
}

internal fun Member.seasonalCommitmentLookupKeys(): List<String> =
    listOf(id.trim()).filter(String::isNotBlank)

/**
 * Resolves commitments through the canonical member-document id.
 *
 * The stored-data inventory and shared Firestore contract both require `userId == member.id`. A successful empty
 * result therefore means that the member has no active seasonal commitments; it must not trigger identity fallbacks.
 */
internal suspend fun loadActiveCommitmentsForMember(
    member: Member,
    loadForUser: suspend (String) -> List<SeasonalCommitment>,
): List<SeasonalCommitment> {
    val canonicalKey = member.seasonalCommitmentLookupKeys().firstOrNull() ?: return emptyList()
    return loadForUser(canonicalKey).normalizedForMemberLookup()
}

private fun List<SeasonalCommitment>.normalizedForMemberLookup(): List<SeasonalCommitment> =
    distinctBy(SeasonalCommitment::id)
        .sortedWith(compareBy<SeasonalCommitment> { it.seasonKey }.thenBy { it.productId })
