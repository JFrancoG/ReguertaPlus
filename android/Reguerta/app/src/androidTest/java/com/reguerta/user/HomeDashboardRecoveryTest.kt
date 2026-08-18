package com.reguerta.user

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.reguerta.user.presentation.home.HomeActionRow
import com.reguerta.user.presentation.home.HomeOrderStateDisplay
import com.reguerta.user.presentation.home.LatestNewsCard
import com.reguerta.user.presentation.root.MyOrderFreshnessUiState
import com.reguerta.user.ui.theme.ReguertaTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class HomeDashboardRecoveryTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun latestNewsDoesNotDuplicateDrawerNavigation() {
        composeRule.setContent {
            ReguertaTheme {
                LatestNewsCard(news = emptyList())
            }
        }

        composeRule.onNodeWithText("Latest news").assertIsDisplayed()
        composeRule.onAllNodesWithText("View all news").assertCountEquals(0)
    }

    @Test
    fun unavailableFreshnessDoesNotExposeRecoveryMessageOrManualRetry() {
        composeRule.setContent {
            ReguertaTheme {
                HomeActionRow(
                    myOrderFreshnessState = MyOrderFreshnessUiState.Unavailable,
                    canOpenReceivedOrders = true,
                    orderState = HomeOrderStateDisplay.NOT_STARTED,
                    isConsultaPhase = false,
                    onOpenMyOrder = {},
                    onOpenReceivedOrders = {},
                )
            }
        }

        composeRule.onAllNodesWithText("Retry check").assertCountEquals(0)
        composeRule.onAllNodesWithText("Critical data could not be validated in time. The app will retry automatically.")
            .assertCountEquals(0)
    }
}
