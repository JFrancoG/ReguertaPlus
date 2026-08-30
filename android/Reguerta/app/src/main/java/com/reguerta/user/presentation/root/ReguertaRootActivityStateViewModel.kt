package com.reguerta.user.presentation.root

import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.lifecycle.ViewModel
import com.reguerta.user.presentation.auth.AuthShellState
import com.reguerta.user.domain.notifications.ShiftNotificationPushReference

/**
 * Owns root presentation state that must survive an activity configuration change.
 *
 * The state deliberately lives only as long as the activity's `ViewModelStore`.
 * A new process therefore retains the existing cold-launch splash, version gate,
 * and session-resolution behavior instead of restoring a partially completed boot.
 */
class ReguertaRootActivityStateViewModel : ViewModel() {
    internal val shellState = mutableStateOf(AuthShellState())
    internal val splashAnimationFinished = mutableStateOf(false)
    internal val startupGateState = mutableStateOf<StartupGateUiState>(StartupGateUiState.Checking)
    internal val startupGateRetryGeneration = mutableIntStateOf(0)
    internal val sessionStartupRefreshRequested = mutableStateOf(false)
    internal val pendingShiftNotificationPush = mutableStateOf<ShiftNotificationPushReference?>(null)

    internal fun retryStartupGate() {
        startupGateState.value = StartupGateUiState.Checking
        startupGateRetryGeneration.intValue += 1
    }

    internal fun acceptShiftNotificationPush(reference: ShiftNotificationPushReference) {
        pendingShiftNotificationPush.value = reference
    }

    internal fun consumeShiftNotificationPush(reference: ShiftNotificationPushReference) {
        if (pendingShiftNotificationPush.value == reference) {
            pendingShiftNotificationPush.value = null
        }
    }
}
