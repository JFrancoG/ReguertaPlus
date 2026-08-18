package com.reguerta.user.presentation.root

import com.reguerta.user.presentation.auth.AuthShellRoute
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class ReguertaRootActivityStateViewModelTest {
    @Test
    fun newOwnerStartsWithColdLaunchState() {
        val viewModel = ReguertaRootActivityStateViewModel()

        assertEquals(AuthShellRoute.SPLASH, viewModel.shellState.value.currentRoute)
        assertFalse(viewModel.splashAnimationFinished.value)
        assertEquals(StartupGateUiState.Checking, viewModel.startupGateState.value)
        assertEquals(0, viewModel.startupGateRetryGeneration.intValue)
        assertFalse(viewModel.sessionStartupRefreshRequested.value)
    }

    @Test
    fun retryRestoresCheckingAndAdvancesGeneration() {
        val viewModel = ReguertaRootActivityStateViewModel()
        viewModel.startupGateState.value = StartupGateUiState.Unavailable

        viewModel.retryStartupGate()

        assertEquals(StartupGateUiState.Checking, viewModel.startupGateState.value)
        assertEquals(1, viewModel.startupGateRetryGeneration.intValue)
    }
}
