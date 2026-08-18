package com.reguerta.user

import android.Manifest
import android.os.Build
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.test.rule.GrantPermissionRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.reguerta.user.presentation.auth.AuthShellRoute
import com.reguerta.user.presentation.auth.AuthShellState
import com.reguerta.user.presentation.root.StartupGateUiState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestRule
import org.junit.runner.Description
import org.junit.runner.RunWith
import org.junit.runners.model.Statement

@RunWith(AndroidJUnit4::class)
class MainActivityRecreationTest {
    @get:Rule(order = 0)
    val notificationPermissionRule: TestRule = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        GrantPermissionRule.grant(Manifest.permission.POST_NOTIFICATIONS)
    } else {
        TestRule { base: Statement, _: Description -> base }
    }

    @get:Rule(order = 1)
    val composeRule = createAndroidComposeRule<MainActivity>()

    @Test
    fun recreationRetainsSessionAndCompletedRootStartup() {
        lateinit var originalSessionViewModel: Any
        lateinit var originalRootStateViewModel: Any

        composeRule.activityRule.scenario.onActivity { activity ->
            originalSessionViewModel = activity.sessionViewModel
            originalRootStateViewModel = activity.rootStateViewModel
            activity.rootStateViewModel.shellState.value = AuthShellState(
                backStack = listOf(AuthShellRoute.WELCOME, AuthShellRoute.LOGIN),
            )
            activity.rootStateViewModel.splashAnimationFinished.value = true
            activity.rootStateViewModel.startupGateState.value = StartupGateUiState.Ready
            activity.rootStateViewModel.sessionStartupRefreshRequested.value = true
        }

        composeRule.activityRule.scenario.recreate()
        composeRule.waitForIdle()

        composeRule.activityRule.scenario.onActivity { recreatedActivity ->
            assertSame(originalSessionViewModel, recreatedActivity.sessionViewModel)
            assertSame(originalRootStateViewModel, recreatedActivity.rootStateViewModel)
            assertEquals(AuthShellRoute.LOGIN, recreatedActivity.rootStateViewModel.shellState.value.currentRoute)
            assertTrue(recreatedActivity.rootStateViewModel.splashAnimationFinished.value)
            assertEquals(StartupGateUiState.Ready, recreatedActivity.rootStateViewModel.startupGateState.value)
            assertTrue(recreatedActivity.rootStateViewModel.sessionStartupRefreshRequested.value)
        }
    }
}
