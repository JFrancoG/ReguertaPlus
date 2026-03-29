package com.reguerta.user.domain.access

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SessionRefreshPolicyTest {
    private val policy = SessionRefreshPolicy(minimumForegroundIntervalMillis = 15_000L)

    @Test
    fun `startup refresh only runs once per cold session`() {
        assertTrue(
            policy.shouldRefresh(
                trigger = SessionRefreshTrigger.STARTUP,
                lastRefreshAtMillis = null,
                nowMillis = 1_000L,
                isRefreshInFlight = false,
            ),
        )

        assertFalse(
            policy.shouldRefresh(
                trigger = SessionRefreshTrigger.STARTUP,
                lastRefreshAtMillis = 1_000L,
                nowMillis = 2_000L,
                isRefreshInFlight = false,
            ),
        )
    }

    @Test
    fun `foreground refresh is debounced and blocked while in flight`() {
        assertFalse(
            policy.shouldRefresh(
                trigger = SessionRefreshTrigger.FOREGROUND,
                lastRefreshAtMillis = 10_000L,
                nowMillis = 20_000L,
                isRefreshInFlight = true,
            ),
        )

        assertFalse(
            policy.shouldRefresh(
                trigger = SessionRefreshTrigger.FOREGROUND,
                lastRefreshAtMillis = 10_000L,
                nowMillis = 20_000L,
                isRefreshInFlight = false,
            ),
        )

        assertTrue(
            policy.shouldRefresh(
                trigger = SessionRefreshTrigger.FOREGROUND,
                lastRefreshAtMillis = 10_000L,
                nowMillis = 25_000L,
                isRefreshInFlight = false,
            ),
        )
    }
}
