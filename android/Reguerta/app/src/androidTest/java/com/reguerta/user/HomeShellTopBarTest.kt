package com.reguerta.user

import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.reguerta.user.presentation.home.HomeShellTopBar
import com.reguerta.user.ui.theme.ReguertaTheme
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class HomeShellTopBarTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun requestedTitlePlacementRendersBelowBackNavigationRow() {
        setTopBarContent(title = "News", placesTitleBelowNavigation = true)

        val backBounds = composeRule
            .onNodeWithContentDescription("Back")
            .fetchSemanticsNode()
            .boundsInRoot
        val titleBounds = composeRule
            .onNodeWithText("News")
            .fetchSemanticsNode()
            .boundsInRoot

        assertTrue(titleBounds.top >= backBounds.bottom)
    }

    @Test
    fun defaultTitlePlacementRemainsInsideNavigationRow() {
        setTopBarContent(title = "Settings", placesTitleBelowNavigation = false)

        val backBounds = composeRule
            .onNodeWithContentDescription("Back")
            .fetchSemanticsNode()
            .boundsInRoot
        val titleCenterY = composeRule
            .onNodeWithText("Settings")
            .fetchSemanticsNode()
            .boundsInRoot
            .center
            .y

        assertTrue(titleCenterY in backBounds.top..backBounds.bottom)
    }

    private fun setTopBarContent(
        title: String,
        placesTitleBelowNavigation: Boolean,
    ) {
        composeRule.setContent {
            ReguertaTheme {
                HomeShellTopBar(
                    title = title,
                    canNavigateBack = true,
                    placesTitleBelowNavigation = placesTitleBelowNavigation,
                    showsNotificationsAction = false,
                    hasNotificationIndicator = false,
                    showsCartAction = false,
                    cartUnits = 0,
                    onBack = {},
                    onOpenMenu = {},
                    onOpenNotifications = {},
                    onOpenCart = {},
                )
            }
        }
    }
}
