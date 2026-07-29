package com.reguerta.user.data.devices

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FirebaseInstallationRegistrationProviderTest {
    @Test
    fun `registration completes before installation id is read`() = runTest {
        val events = mutableListOf<String>()
        val provider = DefaultFirebaseInstallationRegistrationProvider(
            registerMessaging = { events += "register" },
            fetchInstallationId = {
                events += "installation-id"
                " FID-A "
            },
        )

        val result = provider.register()

        assertEquals("FID-A", result)
        assertEquals(listOf("register", "installation-id"), events)
    }

    @Test
    fun `registration failure never reads installation id`() = runTest {
        var installationIdReads = 0
        val provider = DefaultFirebaseInstallationRegistrationProvider(
            registerMessaging = { error("registration failed") },
            fetchInstallationId = {
                installationIdReads += 1
                "FID-A"
            },
        )

        val result = runCatching { provider.register() }

        assertTrue(result.isFailure)
        assertEquals(0, installationIdReads)
    }

    @Test
    fun `blank installation id is normalized to absence`() = runTest {
        val provider = DefaultFirebaseInstallationRegistrationProvider(
            registerMessaging = {},
            fetchInstallationId = { "   " },
        )

        assertNull(provider.register())
    }

    @Test
    fun `installation id failure is propagated`() = runTest {
        val provider = DefaultFirebaseInstallationRegistrationProvider(
            registerMessaging = {},
            fetchInstallationId = { error("installation unavailable") },
        )

        assertTrue(runCatching { provider.register() }.isFailure)
    }
}
