package com.reguerta.user.domain.freshness

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ResolveCriticalDataFreshnessUseCaseTest {
    private val useCase = ResolveCriticalDataFreshnessUseCase(
        remoteRepository = object : CriticalDataFreshnessRemoteRepository {
            override suspend fun getConfig(): CriticalDataFreshnessConfig? = null
        },
        localRepository = object : CriticalDataFreshnessLocalRepository {
            override suspend fun getMetadata(): CriticalDataFreshnessMetadata? = null

            override suspend fun saveMetadata(metadata: CriticalDataFreshnessMetadata) = Unit

            override suspend fun clear() = Unit
        },
    )

    @Test
    fun `evaluate returns invalid config when a critical timestamp is missing`() {
        val remoteTimestamps = CriticalCollection.entries
            .filterNot { it == CriticalCollection.ORDERS }
            .associateWith { 1_000L }

        val evaluation = useCase.evaluate(
            config = CriticalDataFreshnessConfig(
                cacheExpirationMinutes = 15,
                remoteTimestampsMillis = remoteTimestamps,
            ),
            metadata = null,
            nowMillis = 10_000L,
        )

        assertEquals(FreshnessEvaluation.InvalidConfig, evaluation)
    }

    @Test
    fun `evaluate persists metadata when remote timestamps changed`() {
        val remoteTimestamps = CriticalCollection.entries.associateWith { 2_000L }
        val currentMetadata = CriticalDataFreshnessMetadata(
            validatedAtMillis = 5_000L,
            acknowledgedTimestampsMillis = CriticalCollection.entries.associateWith { 1_000L },
        )

        val evaluation = useCase.evaluate(
            config = CriticalDataFreshnessConfig(
                cacheExpirationMinutes = 15,
                remoteTimestampsMillis = remoteTimestamps,
            ),
            metadata = currentMetadata,
            nowMillis = 6_000L,
        )

        assertTrue(evaluation is FreshnessEvaluation.Accepted)
        evaluation as FreshnessEvaluation.Accepted
        assertEquals(
            CriticalDataFreshnessMetadata(
                validatedAtMillis = 6_000L,
                acknowledgedTimestampsMillis = remoteTimestamps,
            ),
            evaluation.metadataToPersist,
        )
    }

    @Test
    fun `evaluate keeps metadata when cache is still valid and unchanged`() {
        val remoteTimestamps = CriticalCollection.entries.associateWith { 2_000L }
        val currentMetadata = CriticalDataFreshnessMetadata(
            validatedAtMillis = 10_000L,
            acknowledgedTimestampsMillis = remoteTimestamps,
        )

        val evaluation = useCase.evaluate(
            config = CriticalDataFreshnessConfig(
                cacheExpirationMinutes = 15,
                remoteTimestampsMillis = remoteTimestamps,
            ),
            metadata = currentMetadata,
            nowMillis = 20_000L,
        )

        assertEquals(
            FreshnessEvaluation.Accepted(metadataToPersist = null),
            evaluation,
        )
    }
}
