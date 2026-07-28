package com.reguerta.user.domain.freshness

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
    val validatedAtMillis: Long,
    val acknowledgedTimestampsMillis: Map<CriticalCollection, Long>,
)

data class CriticalDataFreshnessMetadataWrite(
    val id: String,
    val metadata: CriticalDataFreshnessMetadata,
)

sealed interface CriticalDataFreshnessResolution {
    data class Fresh(
        val metadataToPersist: CriticalDataFreshnessMetadata?,
    ) : CriticalDataFreshnessResolution
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
