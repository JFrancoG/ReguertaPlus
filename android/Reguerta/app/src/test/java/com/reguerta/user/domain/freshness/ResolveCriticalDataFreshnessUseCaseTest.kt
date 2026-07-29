package com.reguerta.user.domain.freshness

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.assertThrows
import org.junit.Test
import kotlinx.coroutines.runBlocking
import com.reguerta.user.domain.RepositoryException
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRole

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
        refresher = CriticalDataRefresher { _, _ -> refreshPayload() },
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
            scope = freshnessScope(),
            nowMillis = 10_000L,
        )

        assertEquals(FreshnessEvaluation.InvalidConfig, evaluation)
    }

    @Test
    fun `evaluate persists metadata when remote timestamps changed`() {
        val remoteTimestamps = CriticalCollection.entries.associateWith { collection ->
            if (collection == CriticalCollection.PRODUCTS) 2_000L else 1_000L
        }
        val currentMetadata = CriticalDataFreshnessMetadata(
            environment = "develop",
            principalUid = "uid-member",
            authenticatedMemberId = "member",
            memberId = "member",
            canManageMembers = false,
            validatedAtMillis = 5_000L,
            acknowledgedTimestampsMillis = CriticalCollection.entries.associateWith { 1_000L },
        )

        val evaluation = useCase.evaluate(
            config = CriticalDataFreshnessConfig(
                cacheExpirationMinutes = 15,
                remoteTimestampsMillis = remoteTimestamps,
            ),
            metadata = currentMetadata,
            scope = freshnessScope(),
            nowMillis = 6_000L,
        )

        assertTrue(evaluation is FreshnessEvaluation.Accepted)
        evaluation as FreshnessEvaluation.Accepted
        assertEquals(
            CriticalDataFreshnessMetadata(
                environment = "develop",
                principalUid = "uid-member",
                authenticatedMemberId = "member",
                memberId = "member",
                canManageMembers = false,
                validatedAtMillis = 6_000L,
                acknowledgedTimestampsMillis = remoteTimestamps,
            ),
            evaluation.metadataToPersist,
        )
        assertEquals(setOf(CriticalCollection.PRODUCTS), evaluation.collectionsToRefresh)
    }

    @Test
    fun `evaluate keeps metadata when cache is still valid and unchanged`() {
        val remoteTimestamps = CriticalCollection.entries.associateWith { 2_000L }
        val currentMetadata = CriticalDataFreshnessMetadata(
            environment = "develop",
            principalUid = "uid-member",
            authenticatedMemberId = "member",
            memberId = "member",
            canManageMembers = false,
            validatedAtMillis = 10_000L,
            acknowledgedTimestampsMillis = remoteTimestamps,
        )

        val evaluation = useCase.evaluate(
            config = CriticalDataFreshnessConfig(
                cacheExpirationMinutes = 15,
                remoteTimestampsMillis = remoteTimestamps,
            ),
            metadata = currentMetadata,
            scope = freshnessScope(),
            nowMillis = 20_000L,
        )

        assertEquals(
            FreshnessEvaluation.Accepted(
                metadataToPersist = null,
                collectionsToRefresh = emptySet(),
            ),
            evaluation,
        )
    }

    @Test
    fun `expired metadata refreshes all critical collections`() {
        val timestamps = CriticalCollection.entries.associateWith { 2_000L }

        val evaluation = useCase.evaluate(
            config = CriticalDataFreshnessConfig(
                cacheExpirationMinutes = 15,
                remoteTimestampsMillis = timestamps,
            ),
            metadata = CriticalDataFreshnessMetadata(
                environment = "develop",
                principalUid = "uid-member",
                authenticatedMemberId = "member",
                memberId = "member",
                canManageMembers = false,
                validatedAtMillis = 0L,
                acknowledgedTimestampsMillis = timestamps,
            ),
            scope = freshnessScope(),
            nowMillis = 900_000L,
        ) as FreshnessEvaluation.Accepted

        assertEquals(CriticalCollection.entries.toSet(), evaluation.collectionsToRefresh)
    }

    @Test
    fun `resolution does not persist metadata before the session fence`() = runBlocking {
        val remoteTimestamps = CriticalCollection.entries.associateWith { 2_000L }
        var saveRequests = 0
        val refreshRequests = mutableListOf<Set<CriticalCollection>>()
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
            refresher = CriticalDataRefresher { _, collections ->
                refreshRequests += collections
                refreshPayload()
            },
            nowProvider = { 3_000L },
        )

        val resolution = useCase(scope = freshnessScope())

        assertEquals(0, saveRequests)
        assertEquals(listOf(CriticalCollection.entries.toSet()), refreshRequests)
        assertEquals(
            CriticalDataFreshnessResolution.Fresh(
                metadataToPersist = CriticalDataFreshnessMetadata(
                    environment = "develop",
                    principalUid = "uid-member",
                    authenticatedMemberId = "member",
                    memberId = "member",
                    canManageMembers = false,
                    validatedAtMillis = 3_000L,
                    acknowledgedTimestampsMillis = remoteTimestamps,
                ),
                refreshedPayload = refreshPayload(),
            ),
            resolution,
        )
    }

    @Test
    fun `resolution always runs ancillary refresh when no critical timestamp changed`() = runBlocking {
        val timestamps = CriticalCollection.entries.associateWith { 2_000L }
        val requestedCollections = mutableListOf<Set<CriticalCollection>>()
        val useCase = ResolveCriticalDataFreshnessUseCase(
            remoteRepository = object : CriticalDataFreshnessRemoteRepository {
                override suspend fun getConfig(environment: String) = CriticalDataFreshnessConfig(
                    cacheExpirationMinutes = 15,
                    remoteTimestampsMillis = timestamps,
                )
            },
            localRepository = object : CriticalDataFreshnessLocalRepository {
                override suspend fun getMetadata() = CriticalDataFreshnessMetadata(
                    environment = "develop",
                    principalUid = "uid-member",
                    authenticatedMemberId = "member",
                    memberId = "member",
                    canManageMembers = false,
                    validatedAtMillis = 10_000L,
                    acknowledgedTimestampsMillis = timestamps,
                )

                override suspend fun saveMetadataIfCurrent(
                    write: CriticalDataFreshnessMetadataWrite,
                    isCurrent: () -> Boolean,
                ): Boolean = false

                override suspend fun rollbackMetadata(write: CriticalDataFreshnessMetadataWrite) = Unit
                override suspend fun clear() = Unit
            },
            refresher = CriticalDataRefresher { _, collections ->
                requestedCollections += collections
                refreshPayload()
            },
            nowProvider = { 20_000L },
        )

        val resolution = useCase(scope = freshnessScope())

        assertEquals(listOf(emptySet<CriticalCollection>()), requestedCollections)
        assertEquals(null, (resolution as CriticalDataFreshnessResolution.Fresh).metadataToPersist)
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
            refresher = CriticalDataRefresher { _, _ -> refreshPayload() },
        )

        assertThrows(RepositoryException::class.java) {
            runBlocking { invalidUseCase(scope = freshnessScope()) }
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
                principalUid = "uid-member",
                authenticatedMemberId = "member",
                memberId = "member",
                canManageMembers = false,
                validatedAtMillis = 19_000L,
                acknowledgedTimestampsMillis = remoteTimestamps,
            ),
            scope = freshnessScope(environment = "production"),
            nowMillis = 20_000L,
        )

        assertEquals(
            FreshnessEvaluation.Accepted(
                metadataToPersist = CriticalDataFreshnessMetadata(
                    environment = "production",
                    principalUid = "uid-member",
                    authenticatedMemberId = "member",
                    memberId = "member",
                    canManageMembers = false,
                    validatedAtMillis = 20_000L,
                    acknowledgedTimestampsMillis = remoteTimestamps,
                ),
                collectionsToRefresh = CriticalCollection.entries.toSet(),
            ),
            evaluation,
        )
    }

    @Test
    fun `uid authenticated member selected member and access changes each force a complete refresh`() {
        val timestamps = CriticalCollection.entries.associateWith { 2_000L }
        val metadata = CriticalDataFreshnessMetadata(
            environment = "develop",
            principalUid = "uid-member",
            authenticatedMemberId = "member",
            memberId = "member",
            canManageMembers = false,
            validatedAtMillis = 19_000L,
            acknowledgedTimestampsMillis = timestamps,
        )
        val changedScopes = listOf(
            freshnessScope(principalUid = "uid-other"),
            freshnessScope(authenticatedMemberId = "authenticated-other"),
            freshnessScope(memberId = "other"),
            freshnessScope(canManageMembers = true),
        )

        changedScopes.forEach { changedScope ->
            val evaluation = useCase.evaluate(
                config = CriticalDataFreshnessConfig(
                    cacheExpirationMinutes = 15,
                    remoteTimestampsMillis = timestamps,
                ),
                metadata = metadata,
                scope = changedScope,
                nowMillis = 20_000L,
            ) as FreshnessEvaluation.Accepted

            assertEquals(CriticalCollection.entries.toSet(), evaluation.collectionsToRefresh)
        }
    }
}

private fun freshnessScope(
    environment: String = "develop",
    principalUid: String = "uid-member",
    authenticatedMemberId: String = "member",
    memberId: String = "member",
    canManageMembers: Boolean = false,
) = CriticalDataRefreshScope(
    environment = environment,
    principalUid = principalUid,
    authenticatedMemberId = authenticatedMemberId,
    memberId = memberId,
    canManageMembers = canManageMembers,
)

private fun refreshPayload(): CriticalDataRefreshPayload {
    val member = Member(
        id = "member",
        displayName = "Member",
        normalizedEmail = "member@reguerta.test",
        authUid = "uid-member",
        roles = setOf(MemberRole.MEMBER),
        isActive = true,
        producerCatalogEnabled = false,
    )
    return CriticalDataRefreshPayload(
        authenticatedMemberId = member.id,
        authenticatedMember = member,
        selectedMember = member,
        seasonalCommitments = emptyList(),
    )
}
