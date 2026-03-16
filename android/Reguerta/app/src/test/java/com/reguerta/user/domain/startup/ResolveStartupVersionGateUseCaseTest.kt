package com.reguerta.user.domain.startup

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
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
    fun `malformed policy falls back to allow`() {
        val useCase = ResolveStartupVersionGateUseCase(FakePolicyRepository(
            policy = StartupVersionPolicy(
                currentVersion = "invalid",
                minimumVersion = "0.3.0",
                forceUpdate = true,
                storeUrl = "https://play.google.com/store/apps/details?id=com.reguerta.user",
            ),
        ))

        val decision = runBlockingDecision(useCase, "0.2.9")

        assertEquals(StartupVersionGateDecision.Allow, decision)
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
        private val policy: StartupVersionPolicy?,
    ) : StartupVersionPolicyRepository {
        override suspend fun getPolicy(platform: StartupPlatform): StartupVersionPolicy? = policy
    }
}
