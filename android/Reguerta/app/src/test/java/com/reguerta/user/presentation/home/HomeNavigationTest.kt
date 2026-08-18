package com.reguerta.user.presentation.home

import com.reguerta.user.domain.access.AuthPrincipal
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.presentation.root.CriticalDataRefreshConsumerReceipt
import com.reguerta.user.presentation.root.EditorConfirmationIdentity
import com.reguerta.user.presentation.root.MyOrderFreshnessUiState
import com.reguerta.user.presentation.root.SessionMode
import com.reguerta.user.presentation.root.SessionUiState
import com.reguerta.user.presentation.root.matchesCriticalDataRefreshConsumerReceipt
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.assertEquals
import org.junit.Test
import java.nio.file.Files
import java.nio.file.Path

class HomeNavigationTest {
    @Test
    fun `editor confirmations are transient and cannot be restored into another process`() {
        val source = homeRouteSource()
        val transientConfirmationFields = listOf(
            "pendingSavedNewsId",
            "pendingSavedNewsWasNew",
            "pendingSavedNewsEditorGeneration",
            "pendingSavedNewsDraftRevision",
            "pendingNotificationEditorGeneration",
            "pendingNotificationDraftRevision",
        )

        transientConfirmationFields.forEach { field ->
            assertTrue(
                "$field must use remember instead of rememberSaveable",
                Regex("var $field by remember \\{").containsMatchIn(source),
            )
            assertFalse(
                "$field must not survive recreation or process restoration",
                Regex("var $field by rememberSaveable \\{").containsMatchIn(source),
            )
        }
    }

    @Test
    fun `save confirmation only owns the exact editor draft acknowledged by the backend`() {
        val confirmation = EditorConfirmationIdentity(
            editorGeneration = 4L,
            draftRevision = 9L,
        )

        assertTrue(editorConfirmationMatches(confirmation, 4L, 9L))
        assertFalse(editorConfirmationMatches(confirmation, 4L, 10L))
        assertFalse(editorConfirmationMatches(confirmation, 5L, 9L))
        assertTrue(editorConfirmationIsSuperseded(confirmation, 4L, 10L))
        assertTrue(editorConfirmationIsSuperseded(confirmation, 5L, 0L))
    }

    @Test
    fun `confirmation waits for its ACK revision instead of being discarded by an older frame`() {
        val confirmation = EditorConfirmationIdentity(
            editorGeneration = 4L,
            draftRevision = 9L,
        )

        assertFalse(editorConfirmationMatches(confirmation, 4L, 8L))
        assertFalse(editorConfirmationIsSuperseded(confirmation, 4L, 8L))
    }

    private fun homeRouteSource(): String {
        val projectRoot = generateSequence(Path.of("").toAbsolutePath()) { it.parent }
            .first { candidate ->
                Files.exists(
                    candidate.resolve(
                        "app/src/main/java/com/reguerta/user/presentation/home/ReguertaRootHomeRoute.kt",
                    ),
                )
            }
        return Files.readString(
            projectRoot.resolve(
                "app/src/main/java/com/reguerta/user/presentation/home/ReguertaRootHomeRoute.kt",
            ),
        )
    }

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
    fun `my order action only blocks while a freshness generation is checking`() {
        assertFalse(MyOrderFreshnessUiState.Checking.allowsMyOrderEntryRequest())
        assertTrue(MyOrderFreshnessUiState.Idle.allowsMyOrderEntryRequest())
        assertTrue(MyOrderFreshnessUiState.Ready.allowsMyOrderEntryRequest())
        assertTrue(MyOrderFreshnessUiState.TimedOut.allowsMyOrderEntryRequest())
        assertTrue(MyOrderFreshnessUiState.Unavailable.allowsMyOrderEntryRequest())
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
