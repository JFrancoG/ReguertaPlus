package com.reguerta.user.domain.freshness

import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.commitments.SeasonalCommitment
import com.reguerta.user.domain.products.Product

enum class CriticalCollection(val wireKey: String) {
    USERS("users"),
    PRODUCTS("products"),
    ORDERS("orders"),
    ORDERLINES("orderlines"),
    CONTAINERS("containers"),
    MEASURES("measures"),
}

data class CriticalDataFreshnessConfig(
    val cacheExpirationMinutes: Int,
    val remoteTimestampsMillis: Map<CriticalCollection, Long>,
)

data class CriticalDataFreshnessMetadata(
    val environment: String,
    val principalUid: String,
    val authenticatedMemberId: String,
    val memberId: String,
    val canManageMembers: Boolean,
    val validatedAtMillis: Long,
    val acknowledgedTimestampsMillis: Map<CriticalCollection, Long>,
)

data class CriticalDataRefreshScope(
    val environment: String,
    val principalUid: String,
    val authenticatedMemberId: String,
    val memberId: String,
    val canManageMembers: Boolean,
)

data class CriticalDataRefreshPayload(
    val authenticatedMemberId: String,
    val authenticatedMember: Member,
    val selectedMember: Member?,
    val seasonalCommitments: List<SeasonalCommitment>?,
    val requiresAccessScopeRetry: Boolean = false,
    val members: List<Member>? = null,
    val products: List<Product>? = null,
) {
    init {
        require(authenticatedMember.id == authenticatedMemberId)
        if (requiresAccessScopeRetry) {
            require(selectedMember == null)
            require(seasonalCommitments == null)
            require(members == null)
            require(products == null)
        } else {
            require(selectedMember != null)
            require(seasonalCommitments != null)
        }
    }
}

data class CriticalDataFreshnessMetadataWrite(
    val id: String,
    val metadata: CriticalDataFreshnessMetadata,
)

sealed interface CriticalDataFreshnessResolution {
    data class Fresh(
        val metadataToPersist: CriticalDataFreshnessMetadata?,
        val refreshedPayload: CriticalDataRefreshPayload,
    ) : CriticalDataFreshnessResolution
}

fun interface CriticalDataRefresher {
    suspend fun refresh(
        scope: CriticalDataRefreshScope,
        collections: Set<CriticalCollection>,
    ): CriticalDataRefreshPayload
}

interface CriticalDataFreshnessRemoteRepository {
    suspend fun getConfig(environment: String): CriticalDataFreshnessConfig
}

interface CriticalDataFreshnessLocalRepository {
    suspend fun getMetadata(): CriticalDataFreshnessMetadata?

    suspend fun saveMetadataIfCurrent(
        write: CriticalDataFreshnessMetadataWrite,
        isCurrent: () -> Boolean,
    ): Boolean

    suspend fun rollbackMetadata(write: CriticalDataFreshnessMetadataWrite)

    suspend fun clear()
}
