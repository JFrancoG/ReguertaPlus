package com.reguerta.user.presentation.home

import com.reguerta.user.domain.access.AuthPrincipal
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.presentation.root.CriticalDataRefreshConsumerReceipt
import com.reguerta.user.presentation.root.MyOrderFreshnessUiState
import com.reguerta.user.presentation.root.SessionMode
import com.reguerta.user.presentation.root.SessionUiState
import com.reguerta.user.presentation.root.matchesCriticalDataRefreshConsumerReceipt
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.assertEquals
import org.junit.Test

class HomeNavigationTest {
    @Test
    fun adminBroadcastBackReturnsToDashboard() {
        assertEquals(
            HomeDestination.DASHBOARD,
            HomeDestination.ADMIN_BROADCAST.backDestination(),
        )
    }

    @Test
    fun contextualEditorsKeepTheirParentDestination() {
        assertEquals(
            HomeDestination.NEWS,
            HomeDestination.PUBLISH_NEWS.backDestination(),
        )
        assertEquals(
            HomeDestination.SHIFTS,
            HomeDestination.SHIFT_SWAP_REQUEST.backDestination(),
        )
    }

    @Test
    fun restoredMyOrderDestinationReturnsToDashboardForARealGate() {
        assertEquals(
            HomeDestination.DASHBOARD,
            restoredHomeDestination(HomeDestination.MY_ORDER.name),
        )
        assertEquals(
            HomeDestination.NEWS,
            restoredHomeDestination(HomeDestination.NEWS.name),
        )
    }

    @Test
    fun startupReadyNeverConsumesAnEntryRequest() {
        assertFalse(
            shouldNavigateToMyOrder(
                pendingGeneration = null,
                completedGeneration = 4L,
                freshnessState = MyOrderFreshnessUiState.Ready,
                receiptIsCurrent = true,
            ),
        )
    }

    @Test
    fun onlyMatchingReadyGenerationConsumesEntryRequest() {
        assertFalse(
            shouldNavigateToMyOrder(
                pendingGeneration = 5L,
                completedGeneration = 4L,
                freshnessState = MyOrderFreshnessUiState.Ready,
                receiptIsCurrent = true,
            ),
        )
        assertFalse(
            shouldNavigateToMyOrder(
                pendingGeneration = 5L,
                completedGeneration = 5L,
                freshnessState = MyOrderFreshnessUiState.Checking,
                receiptIsCurrent = true,
            ),
        )
        assertTrue(
            shouldNavigateToMyOrder(
                pendingGeneration = 5L,
                completedGeneration = 5L,
                freshnessState = MyOrderFreshnessUiState.Ready,
                receiptIsCurrent = true,
            ),
        )
        assertFalse(
            shouldNavigateToMyOrder(
                pendingGeneration = 5L,
                completedGeneration = 5L,
                freshnessState = MyOrderFreshnessUiState.Ready,
                receiptIsCurrent = false,
            ),
        )
    }

    @Test
    fun `same scope writer after ready invalidates navigation receipt`() {
        val refreshedMember = navigationMember(displayName = "Refreshed")
        val refreshedMode = SessionMode.Authorized(
            principal = AuthPrincipal(
                uid = "uid-member",
                email = refreshedMember.normalizedEmail,
            ),
            authenticatedMember = refreshedMember,
            member = refreshedMember,
            members = listOf(refreshedMember),
        )
        val receipt = CriticalDataRefreshConsumerReceipt(
            mode = refreshedMode,
            myOrderProductsFeed = emptyList(),
            myOrderSeasonalCommitmentsFeed = emptyList(),
        )
        val staleMember = refreshedMember.copy(displayName = "Stale")
        val displacedState = SessionUiState(
            mode = refreshedMode.copy(
                authenticatedMember = staleMember,
                member = staleMember,
                members = listOf(staleMember),
            ),
            myOrderFreshnessState = MyOrderFreshnessUiState.Ready,
            myOrderFreshnessGeneration = 9L,
            myOrderFreshnessConsumerReceipt = receipt,
        )
        val receiptIsCurrent = displacedState.matchesCriticalDataRefreshConsumerReceipt(receipt)

        assertFalse(receiptIsCurrent)
        assertFalse(
            shouldNavigateToMyOrder(
                pendingGeneration = 9L,
                completedGeneration = 9L,
                freshnessState = MyOrderFreshnessUiState.Ready,
                receiptIsCurrent = receiptIsCurrent,
            ),
        )
    }
}

private fun navigationMember(displayName: String) = Member(
    id = "member",
    displayName = displayName,
    normalizedEmail = "member@reguerta.test",
    authUid = "uid-member",
    roles = setOf(MemberRole.MEMBER),
    isActive = true,
    producerCatalogEnabled = false,
)
