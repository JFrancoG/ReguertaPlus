package com.reguerta.user.domain.startup

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import com.reguerta.user.domain.RepositoryException
import org.junit.Test

class ResolveStartupVersionGateUseCaseTest {
    @Test
    fun `semantic comparator compares variable-length versions`() {
        assertEquals(0, SemanticVersionComparator.compare("0.3", "0.3.0"))
        assertEquals(1, SemanticVersionComparator.compare("0.3.0.1", "0.3.0"))
        assertEquals(-1, SemanticVersionComparator.compare("0.2.9", "0.3.0"))
        assertNull(SemanticVersionComparator.compare("0.3-beta", "0.3.0"))
    }

    @Test
    fun `force update blocks when installed version is below minimum`() {
        val useCase = ResolveStartupVersionGateUseCase(FakePolicyRepository(
            policy = StartupVersionPolicy(
                currentVersion = "0.3.1",
                minimumVersion = "0.3.0",
                forceUpdate = true,
                storeUrl = "https://play.google.com/store/apps/details?id=com.reguerta.user",
            ),
        ))

        val decision = runBlockingDecision(useCase, "0.2.9")

        assertEquals(
            StartupVersionGateDecision.ForcedUpdate(
                storeUrl = "https://play.google.com/store/apps/details?id=com.reguerta.user",
            ),
            decision,
        )
    }

    @Test
    fun `optional update allows continuation when installed version is below current`() {
        val useCase = ResolveStartupVersionGateUseCase(FakePolicyRepository(
            policy = StartupVersionPolicy(
                currentVersion = "0.3.1",
                minimumVersion = "0.3.0",
                forceUpdate = false,
                storeUrl = "https://play.google.com/store/apps/details?id=com.reguerta.user",
            ),
        ))

        val decision = runBlockingDecision(useCase, "0.3.0")

        assertEquals(
            StartupVersionGateDecision.OptionalUpdate(
                storeUrl = "https://play.google.com/store/apps/details?id=com.reguerta.user",
            ),
            decision,
        )
    }

    @Test
    fun `malformed policy is rejected`() {
        val useCase = ResolveStartupVersionGateUseCase(FakePolicyRepository(
            policy = StartupVersionPolicy(
                currentVersion = "invalid",
                minimumVersion = "0.3.0",
                forceUpdate = true,
                storeUrl = "https://play.google.com/store/apps/details?id=com.reguerta.user",
            ),
        ))

        assertThrows(RepositoryException::class.java) {
            useCase.evaluate(
                installedVersion = "0.2.9",
                policy = StartupVersionPolicy(
                    currentVersion = "invalid",
                    minimumVersion = "0.3.0",
                    forceUpdate = true,
                    storeUrl = "https://play.google.com/store/apps/details?id=com.reguerta.user",
                ),
            )
        }
    }

    @Test
    fun `semantic comparator rejects overflowing components`() {
        val overflowingComponent = "9".repeat(100)

        assertNull(SemanticVersionComparator.compare("1.$overflowingComponent.0", "1.0.0"))
    }

    @Test
    fun `policy rejects non http store URL`() {
        val useCase = ResolveStartupVersionGateUseCase(FakePolicyRepository(validPolicy()))

        assertThrows(RepositoryException::class.java) {
            useCase.evaluate(
                installedVersion = "0.3.0",
                policy = validPolicy().copy(storeUrl = "market://details?id=com.reguerta.user"),
            )
        }
    }

    @Test
    fun `policy rejects minimum above current version`() {
        val useCase = ResolveStartupVersionGateUseCase(FakePolicyRepository(validPolicy()))

        assertThrows(RepositoryException::class.java) {
            useCase.evaluate(
                installedVersion = "0.3.0",
                policy = validPolicy().copy(currentVersion = "0.3.0", minimumVersion = "0.4.0"),
            )
        }
    }

    private fun runBlockingDecision(
        useCase: ResolveStartupVersionGateUseCase,
        installedVersion: String,
    ): StartupVersionGateDecision = kotlinx.coroutines.runBlocking {
        useCase(
            platform = StartupPlatform.ANDROID,
            installedVersion = installedVersion,
        )
    }

    private class FakePolicyRepository(
        private val policy: StartupVersionPolicy,
    ) : StartupVersionPolicyRepository {
        override suspend fun getPolicy(platform: StartupPlatform): StartupVersionPolicy = policy
    }

    private fun validPolicy() = StartupVersionPolicy(
        currentVersion = "0.3.1",
        minimumVersion = "0.3.0",
        forceUpdate = false,
        storeUrl = "https://play.google.com/store/apps/details?id=com.reguerta.user",
    )
}
