package com.reguerta.user.presentation.root

import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import com.reguerta.user.domain.startup.StartupVersionGateDecision
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.fail
import org.junit.Test
import kotlin.time.Duration.Companion.milliseconds

class StartupGateUiStateTest {
    @Test
    fun `timeout is explicit and does not silently allow startup`() = runTest {
        val state = resolveStartupGateUiState(timeout = 100.milliseconds) {
            delay(1_000)
            StartupVersionGateDecision.Allow
        }

        assertEquals(StartupGateUiState.TimedOut, state)
        assertEquals(false, state.allowsContinuation)
    }

    @Test
    fun `repository failure is explicit and does not silently allow startup`() = runTest {
        val state = resolveStartupGateUiState(timeout = 100.milliseconds) {
            throw RepositoryException(
                kind = RepositoryErrorKind.UNAVAILABLE,
                resource = "startupVersionPolicy",
            )
        }

        assertEquals(StartupGateUiState.Unavailable, state)
        assertEquals(false, state.allowsContinuation)
    }

    @Test
    fun `parent cancellation is preserved`() = runTest {
        val cancellation = CancellationException("cancelled by parent")

        try {
            resolveStartupGateUiState(timeout = 100.milliseconds) {
                throw cancellation
            }
            fail("Expected CancellationException")
        } catch (error: CancellationException) {
            assertEquals(cancellation.message, error.message)
        }
    }
}
