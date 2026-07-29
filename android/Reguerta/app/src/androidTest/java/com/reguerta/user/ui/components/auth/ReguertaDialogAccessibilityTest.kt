package com.reguerta.user.ui.components.auth

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.reguerta.user.ui.theme.ReguertaTheme
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ReguertaDialogAccessibilityTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun longContentKeepsStackedActionsVisibleAndContentScrollable() {
        composeRule.setContent {
            ReguertaTheme {
                ReguertaDialog(
                    type = ReguertaDialogType.ERROR,
                    title = "Version check unavailable",
                    message = List(30) {
                        "The app could not confirm the current version policy."
                    }.joinToString(separator = " "),
                    primaryAction = ReguertaDialogAction(label = "Retry version check", onClick = {}),
                    secondaryAction = ReguertaDialogAction(label = "Continue without checking", onClick = {}),
                )
            }
        }

        composeRule.onNode(hasScrollAction(), useUnmergedTree = true).assertExists()
        composeRule.onNodeWithText("Continue without checking").assertIsDisplayed()
        composeRule.onNodeWithText("Retry version check").assertIsDisplayed()

        val continueBounds = composeRule.onNodeWithText("Continue without checking")
            .fetchSemanticsNode().boundsInRoot
        val retryBounds = composeRule.onNodeWithText("Retry version check")
            .fetchSemanticsNode().boundsInRoot
        assertTrue(
            "Expected vertically stacked actions, continue=$continueBounds retry=$retryBounds",
            retryBounds.top > continueBounds.bottom,
        )
        assertTrue(
            "Expected equal full-width actions, continue=$continueBounds retry=$retryBounds",
            kotlin.math.abs(retryBounds.width - continueBounds.width) < 1f,
        )
    }
}
