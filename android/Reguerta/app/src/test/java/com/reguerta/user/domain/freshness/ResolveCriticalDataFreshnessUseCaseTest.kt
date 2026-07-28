package com.reguerta.user.domain.freshness

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.assertThrows
import org.junit.Test
import kotlinx.coroutines.runBlocking
import com.reguerta.user.domain.RepositoryException

class ResolveCriticalDataFreshnessUseCaseTest {
    private val useCase = ResolveCriticalDataFreshnessUseCase(
        remoteRepository = object : CriticalDataFreshnessRemoteRepository {
            override suspend fun getConfig(environment: String): CriticalDataFreshnessConfig =
                error("Not used by evaluate tests")
        },
        localRepository = object : CriticalDataFreshnessLocalRepository {
            override suspend fun getMetadata(): CriticalDataFreshnessMetadata? = null

            override suspend fun saveMetadataIfCurrent(
                write: CriticalDataFreshnessMetadataWrite,
                isCurrent: () -> Boolean,
            ): Boolean = false

            override suspend fun rollbackMetadata(write: CriticalDataFreshnessMetadataWrite) = Unit

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
            environment = "develop",
            nowMillis = 10_000L,
        )

        assertEquals(FreshnessEvaluation.InvalidConfig, evaluation)
    }

    @Test
    fun `evaluate persists metadata when remote timestamps changed`() {
        val remoteTimestamps = CriticalCollection.entries.associateWith { 2_000L }
        val currentMetadata = CriticalDataFreshnessMetadata(
            environment = "develop",
            validatedAtMillis = 5_000L,
            acknowledgedTimestampsMillis = CriticalCollection.entries.associateWith { 1_000L },
        )

        val evaluation = useCase.evaluate(
            config = CriticalDataFreshnessConfig(
                cacheExpirationMinutes = 15,
                remoteTimestampsMillis = remoteTimestamps,
            ),
            metadata = currentMetadata,
            environment = "develop",
            nowMillis = 6_000L,
        )

        assertTrue(evaluation is FreshnessEvaluation.Accepted)
        evaluation as FreshnessEvaluation.Accepted
        assertEquals(
            CriticalDataFreshnessMetadata(
                environment = "develop",
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
            environment = "develop",
            validatedAtMillis = 10_000L,
            acknowledgedTimestampsMillis = remoteTimestamps,
        )

        val evaluation = useCase.evaluate(
            config = CriticalDataFreshnessConfig(
                cacheExpirationMinutes = 15,
                remoteTimestampsMillis = remoteTimestamps,
            ),
            metadata = currentMetadata,
            environment = "develop",
            nowMillis = 20_000L,
        )

        assertEquals(
            FreshnessEvaluation.Accepted(metadataToPersist = null),
            evaluation,
        )
    }

    @Test
    fun `resolution does not persist metadata before the session fence`() = runBlocking {
        val remoteTimestamps = CriticalCollection.entries.associateWith { 2_000L }
        var saveRequests = 0
        val useCase = ResolveCriticalDataFreshnessUseCase(
            remoteRepository = object : CriticalDataFreshnessRemoteRepository {
                override suspend fun getConfig(environment: String) = CriticalDataFreshnessConfig(
                    cacheExpirationMinutes = 15,
                    remoteTimestampsMillis = remoteTimestamps,
                )
            },
            localRepository = object : CriticalDataFreshnessLocalRepository {
                override suspend fun getMetadata(): CriticalDataFreshnessMetadata? = null

                override suspend fun saveMetadataIfCurrent(
                    write: CriticalDataFreshnessMetadataWrite,
                    isCurrent: () -> Boolean,
                ): Boolean {
                    saveRequests += 1
                    return true
                }

                override suspend fun rollbackMetadata(write: CriticalDataFreshnessMetadataWrite) = Unit

                override suspend fun clear() = Unit
            },
            nowProvider = { 3_000L },
        )

        val resolution = useCase(environment = "develop")

        assertEquals(0, saveRequests)
        assertEquals(
            CriticalDataFreshnessResolution.Fresh(
                metadataToPersist = CriticalDataFreshnessMetadata(
                    environment = "develop",
                    validatedAtMillis = 3_000L,
                    acknowledgedTimestampsMillis = remoteTimestamps,
                ),
            ),
            resolution,
        )
    }

    @Test
    fun `invalid config throws a typed repository error`() {
        val invalidUseCase = ResolveCriticalDataFreshnessUseCase(
            remoteRepository = object : CriticalDataFreshnessRemoteRepository {
                override suspend fun getConfig(environment: String) = CriticalDataFreshnessConfig(
                    cacheExpirationMinutes = 0,
                    remoteTimestampsMillis = emptyMap(),
                )
            },
            localRepository = object : CriticalDataFreshnessLocalRepository {
                override suspend fun getMetadata(): CriticalDataFreshnessMetadata? = null
                override suspend fun saveMetadataIfCurrent(
                    write: CriticalDataFreshnessMetadataWrite,
                    isCurrent: () -> Boolean,
                ): Boolean = false

                override suspend fun rollbackMetadata(write: CriticalDataFreshnessMetadataWrite) = Unit
                override suspend fun clear() = Unit
            },
        )

        assertThrows(RepositoryException::class.java) {
            runBlocking { invalidUseCase(environment = "develop") }
        }
    }

    @Test
    fun `metadata from another environment is treated as stale`() {
        val remoteTimestamps = CriticalCollection.entries.associateWith { 2_000L }
        val evaluation = useCase.evaluate(
            config = CriticalDataFreshnessConfig(
                cacheExpirationMinutes = 15,
                remoteTimestampsMillis = remoteTimestamps,
            ),
            metadata = CriticalDataFreshnessMetadata(
                environment = "develop",
                validatedAtMillis = 19_000L,
                acknowledgedTimestampsMillis = remoteTimestamps,
            ),
            environment = "production",
            nowMillis = 20_000L,
        )

        assertEquals(
            FreshnessEvaluation.Accepted(
                metadataToPersist = CriticalDataFreshnessMetadata(
                    environment = "production",
                    validatedAtMillis = 20_000L,
                    acknowledgedTimestampsMillis = remoteTimestamps,
                ),
            ),
            evaluation,
        )
    }
}
