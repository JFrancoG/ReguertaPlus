package com.reguerta.user

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.reguerta.user.domain.news.NewsArticle
import com.reguerta.user.presentation.access.NewsFeedRoute
import com.reguerta.user.ui.theme.ReguertaTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class NewsFeedRouteTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun adminNewsFeedShowsMetadataIconActionsAndCreateAction() {
        composeRule.setContent {
            ReguertaTheme {
                NewsFeedRoute(
                    articles = listOf(newsArticle(active = false)),
                    isLoading = false,
                    isAdmin = true,
                    onCreateNews = {},
                    onEditNews = {},
                    onRequestDeleteNews = {},
                )
            }
        }

        composeRule.onNodeWithText("Published by Ana Admin").assertIsDisplayed()
        composeRule.onNodeWithText("Archived").assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Edit news").assertIsDisplayed()
        composeRule.onNodeWithContentDescription("Delete news").assertIsDisplayed()
        composeRule.onNodeWithText("New news").assertIsDisplayed()
    }

    @Test
    fun memberNewsFeedHidesAdminActions() {
        composeRule.setContent {
            ReguertaTheme {
                NewsFeedRoute(
                    articles = listOf(newsArticle()),
                    isLoading = false,
                    isAdmin = false,
                    onCreateNews = {},
                    onEditNews = {},
                    onRequestDeleteNews = {},
                )
            }
        }

        composeRule.onAllNodesWithContentDescription("Edit news").assertCountEquals(0)
        composeRule.onAllNodesWithContentDescription("Delete news").assertCountEquals(0)
        composeRule.onAllNodesWithText("New news").assertCountEquals(0)
    }

    private fun newsArticle(active: Boolean = true): NewsArticle =
        NewsArticle(
            id = "news_1",
            title = "Assembly update",
            body = "Remember to bring crates.",
            active = active,
            publishedBy = "Ana Admin",
            publishedAtMillis = 1_000,
            urlImage = null,
        )
}
