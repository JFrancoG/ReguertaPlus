package com.reguerta.user

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performScrollTo
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.profiles.SharedProfile
import com.reguerta.user.presentation.access.HomeDestination
import com.reguerta.user.presentation.access.HomeDrawerContent
import com.reguerta.user.ui.theme.ReguertaTheme
import org.junit.Rule
import org.junit.Test

class HomeDrawerContentTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun drawerMatchesIosNavigationLabelsAndKeepsRoleBasedActions() {
        composeRule.setContent {
            ReguertaTheme {
                HomeDrawerContent(
                    member = fullAccessMember(),
                    sharedProfile = sharedProfile(),
                    currentDestination = HomeDestination.MY_ORDERS,
                    installedVersion = "0.3.0.1",
                    isDevelopBuild = true,
                    onNavigate = {},
                    onCloseDrawer = {},
                    onSignOut = {},
                )
            }
        }

        composeRule.onAllNodesWithText("Home").assertCountEquals(0)
        composeRule.onAllNodesWithText("My order").assertCountEquals(0)
        composeRule.onNodeWithText("All my orders").assertIsDisplayed()
        composeRule.onNodeWithText("Shifts").assertIsDisplayed()
        composeRule.onNodeWithText("Consult bylaws").assertIsDisplayed()
        composeRule.onNodeWithText("News").assertIsDisplayed()
        composeRule.onNodeWithText("Community").assertIsDisplayed()
        composeRule.onNodeWithText("Settings").assertIsDisplayed()
        composeRule.onNodeWithText("Products").assertIsDisplayed()
        composeRule.onNodeWithText("Order history").assertIsDisplayed()
        composeRule.onNodeWithText("Users").performScrollTo().assertIsDisplayed()
        composeRule.onNodeWithText("Send notification").performScrollTo().assertIsDisplayed()
        composeRule.onNodeWithText("Sign out").assertIsDisplayed()
    }

    private fun fullAccessMember(): Member =
        Member(
            id = "member-1",
            displayName = "Nohemi, Jesus, Iara y Lluvia",
            normalizedEmail = "ophiura@yahoo.es",
            authUid = "auth-1",
            roles = setOf(MemberRole.MEMBER, MemberRole.PRODUCER, MemberRole.ADMIN),
            isActive = true,
            producerCatalogEnabled = true,
        )

    private fun sharedProfile(): SharedProfile =
        SharedProfile(
            userId = "member-1",
            familyNames = "Nohemi, Jesus, Iara y Lluvia",
            photoUrl = null,
            about = "",
            updatedAtMillis = 0L,
        )
}
