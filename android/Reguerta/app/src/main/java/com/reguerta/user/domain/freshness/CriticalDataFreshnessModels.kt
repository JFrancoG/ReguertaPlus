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
    val validatedAtMillis: Long,
    val acknowledgedTimestampsMillis: Map<CriticalCollection, Long>,
)

sealed interface CriticalDataFreshnessResolution {
    data object Fresh : CriticalDataFreshnessResolution

    data object InvalidConfig : CriticalDataFreshnessResolution
}

interface CriticalDataFreshnessRemoteRepository {
    suspend fun getConfig(): CriticalDataFreshnessConfig?
}

interface CriticalDataFreshnessLocalRepository {
    suspend fun getMetadata(): CriticalDataFreshnessMetadata?

    suspend fun saveMetadata(metadata: CriticalDataFreshnessMetadata)

    suspend fun clear()
}
