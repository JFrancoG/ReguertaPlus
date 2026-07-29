package com.reguerta.user.domain.freshness

import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException

class ResolveCriticalDataFreshnessUseCase(
    private val remoteRepository: CriticalDataFreshnessRemoteRepository,
    private val localRepository: CriticalDataFreshnessLocalRepository,
    private val refresher: CriticalDataRefresher,
    private val nowProvider: () -> Long = { System.currentTimeMillis() },
) {
    suspend operator fun invoke(scope: CriticalDataRefreshScope): CriticalDataFreshnessResolution {
        if (
            scope.environment.isBlank() ||
            scope.principalUid.isBlank() ||
            scope.authenticatedMemberId.isBlank() ||
            scope.memberId.isBlank()
        ) {
            throw invalidFreshnessConfig()
        }
        val config = remoteRepository.getConfig(environment = scope.environment)
        val existingMetadata = localRepository.getMetadata()
        val nowMillis = nowProvider()
        val evaluation = evaluate(
            config = config,
            metadata = existingMetadata,
            scope = scope,
            nowMillis = nowMillis,
        )

        return when (evaluation) {
            is FreshnessEvaluation.InvalidConfig -> throw invalidFreshnessConfig()

            is FreshnessEvaluation.Accepted -> {
                val payload = refresher.refresh(
                    scope = scope,
                    collections = evaluation.collectionsToRefresh,
                )
                CriticalDataFreshnessResolution.Fresh(
                    metadataToPersist = evaluation.metadataToPersist,
                    refreshedPayload = payload,
                )
            }
        }
    }

    fun evaluate(
        config: CriticalDataFreshnessConfig,
        metadata: CriticalDataFreshnessMetadata?,
        scope: CriticalDataRefreshScope,
        nowMillis: Long,
    ): FreshnessEvaluation {
        if (config.cacheExpirationMinutes <= 0) {
            return FreshnessEvaluation.InvalidConfig
        }

        val remoteTimestamps = config.remoteTimestampsMillis
        if (CriticalCollection.entries.any { collection ->
                remoteTimestamps[collection] == null || remoteTimestamps.getValue(collection) <= 0L
            }
        ) {
            return FreshnessEvaluation.InvalidConfig
        }

        val metadataForScope = metadata?.takeIf {
                it.environment == scope.environment &&
                it.principalUid == scope.principalUid &&
                it.authenticatedMemberId == scope.authenticatedMemberId &&
                it.memberId == scope.memberId &&
                it.canManageMembers == scope.canManageMembers
        }
        val ttlMillis = config.cacheExpirationMinutes * 60_000L
        val isExpired = metadataForScope == null ||
            nowMillis - metadataForScope.validatedAtMillis >= ttlMillis
        val changedCollections = CriticalCollection.entries.filterTo(linkedSetOf()) { collection ->
            metadataForScope?.acknowledgedTimestampsMillis?.get(collection) != remoteTimestamps[collection]
        }
        val collectionsToRefresh = if (isExpired) CriticalCollection.entries.toSet() else changedCollections

        val metadataToPersist = if (collectionsToRefresh.isNotEmpty()) {
            CriticalDataFreshnessMetadata(
                environment = scope.environment,
                principalUid = scope.principalUid,
                authenticatedMemberId = scope.authenticatedMemberId,
                memberId = scope.memberId,
                canManageMembers = scope.canManageMembers,
                validatedAtMillis = nowMillis,
                acknowledgedTimestampsMillis = remoteTimestamps,
            )
        } else {
            null
        }

        return FreshnessEvaluation.Accepted(
            metadataToPersist = metadataToPersist,
            collectionsToRefresh = collectionsToRefresh,
        )
    }
}

private fun invalidFreshnessConfig() = RepositoryException(
    kind = RepositoryErrorKind.INVALID_DATA,
    resource = "criticalDataFreshness.config",
)

sealed interface FreshnessEvaluation {
    data class Accepted(
        val metadataToPersist: CriticalDataFreshnessMetadata?,
        val collectionsToRefresh: Set<CriticalCollection>,
    ) : FreshnessEvaluation

    data object InvalidConfig : FreshnessEvaluation
}
