package com.reguerta.user.domain.freshness

import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException

class ResolveCriticalDataFreshnessUseCase(
    private val remoteRepository: CriticalDataFreshnessRemoteRepository,
    private val localRepository: CriticalDataFreshnessLocalRepository,
    private val nowProvider: () -> Long = { System.currentTimeMillis() },
) {
    suspend operator fun invoke(environment: String): CriticalDataFreshnessResolution {
        if (environment.isBlank()) {
            throw invalidFreshnessConfig()
        }
        val config = remoteRepository.getConfig(environment = environment)
        val existingMetadata = localRepository.getMetadata()
        val nowMillis = nowProvider()
        val evaluation = evaluate(
            config = config,
            metadata = existingMetadata,
            environment = environment,
            nowMillis = nowMillis,
        )

        return when (evaluation) {
            is FreshnessEvaluation.InvalidConfig -> throw invalidFreshnessConfig()

            is FreshnessEvaluation.Accepted -> CriticalDataFreshnessResolution.Fresh(
                metadataToPersist = evaluation.metadataToPersist,
            )
        }
    }

    fun evaluate(
        config: CriticalDataFreshnessConfig,
        metadata: CriticalDataFreshnessMetadata?,
        environment: String,
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

        val metadataForEnvironment = metadata?.takeIf { it.environment == environment }
        val ttlMillis = config.cacheExpirationMinutes * 60_000L
        val isExpired = metadataForEnvironment == null ||
            nowMillis - metadataForEnvironment.validatedAtMillis >= ttlMillis
        val hasRemoteUpdates = metadataForEnvironment == null || CriticalCollection.entries.any { collection ->
            metadataForEnvironment.acknowledgedTimestampsMillis[collection] != remoteTimestamps[collection]
        }

        val metadataToPersist = if (isExpired || hasRemoteUpdates) {
            CriticalDataFreshnessMetadata(
                environment = environment,
                validatedAtMillis = nowMillis,
                acknowledgedTimestampsMillis = remoteTimestamps,
            )
        } else {
            null
        }

        return FreshnessEvaluation.Accepted(metadataToPersist = metadataToPersist)
    }
}

private fun invalidFreshnessConfig() = RepositoryException(
    kind = RepositoryErrorKind.INVALID_DATA,
    resource = "criticalDataFreshness.config",
)

sealed interface FreshnessEvaluation {
    data class Accepted(
        val metadataToPersist: CriticalDataFreshnessMetadata?,
    ) : FreshnessEvaluation

    data object InvalidConfig : FreshnessEvaluation
}
