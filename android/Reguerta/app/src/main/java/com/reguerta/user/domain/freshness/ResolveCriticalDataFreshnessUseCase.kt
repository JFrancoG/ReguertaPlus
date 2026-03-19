package com.reguerta.user.domain.freshness

class ResolveCriticalDataFreshnessUseCase(
    private val remoteRepository: CriticalDataFreshnessRemoteRepository,
    private val localRepository: CriticalDataFreshnessLocalRepository,
    private val nowProvider: () -> Long = { System.currentTimeMillis() },
) {
    suspend operator fun invoke(): CriticalDataFreshnessResolution {
        val config = remoteRepository.getConfig() ?: return CriticalDataFreshnessResolution.InvalidConfig
        val existingMetadata = localRepository.getMetadata()
        val nowMillis = nowProvider()
        val evaluation = evaluate(
            config = config,
            metadata = existingMetadata,
            nowMillis = nowMillis,
        )

        return when (evaluation) {
            is FreshnessEvaluation.InvalidConfig -> CriticalDataFreshnessResolution.InvalidConfig
            is FreshnessEvaluation.Accepted -> {
                evaluation.metadataToPersist?.let { metadata ->
                    localRepository.saveMetadata(metadata)
                }
                CriticalDataFreshnessResolution.Fresh
            }
        }
    }

    fun evaluate(
        config: CriticalDataFreshnessConfig,
        metadata: CriticalDataFreshnessMetadata?,
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

        val ttlMillis = config.cacheExpirationMinutes * 60_000L
        val isExpired = metadata == null || nowMillis - metadata.validatedAtMillis >= ttlMillis
        val hasRemoteUpdates = metadata == null || CriticalCollection.entries.any { collection ->
            metadata.acknowledgedTimestampsMillis[collection] != remoteTimestamps[collection]
        }

        val metadataToPersist = if (isExpired || hasRemoteUpdates) {
            CriticalDataFreshnessMetadata(
                validatedAtMillis = nowMillis,
                acknowledgedTimestampsMillis = remoteTimestamps,
            )
        } else {
            null
        }

        return FreshnessEvaluation.Accepted(metadataToPersist = metadataToPersist)
    }
}

sealed interface FreshnessEvaluation {
    data class Accepted(
        val metadataToPersist: CriticalDataFreshnessMetadata?,
    ) : FreshnessEvaluation

    data object InvalidConfig : FreshnessEvaluation
}
