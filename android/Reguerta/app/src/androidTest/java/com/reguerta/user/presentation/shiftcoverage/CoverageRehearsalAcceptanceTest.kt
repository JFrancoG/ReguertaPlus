package com.reguerta.user.presentation.shiftcoverage

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.unit.Density
import androidx.test.espresso.Espresso.pressBack
import androidx.test.platform.app.InstrumentationRegistry
import com.reguerta.user.data.shiftcoverage.LocalCoverageRehearsalAccess
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageSnapshot
import com.reguerta.user.ui.theme.ReguertaTheme
import org.junit.Assert.assertEquals
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test

/** Opt-in real emulator transport with production Compose; cancelling must not mutate either case. */
class CoverageRehearsalAcceptanceTest {
    @get:Rule val compose = createComposeRule()
    private lateinit var model: CoverageRehearsalViewModel

    @Test fun memberNotificationAndBackKeepTheOfferAndOtherCasesAtLargeText() {
        start("d")
        var eventId = ""
        compose.runOnIdle { eventId = model.coverage.state.value.snapshot!!.notifications.first().eventId }
        show("coverage.notification.$eventId")
        compose.onNodeWithTag("coverage.notification.$eventId").performClick()
        compose.waitUntil(15_000) { model.selectedCaseId == "native-market" && !model.coverage.state.value.isBusy }
        show("coverage.action.accept")
        compose.onNodeWithTag("coverage.action.accept").assertIsEnabled().performClick()
        compose.onNodeWithTag("coverage.confirm").performScrollTo().assertIsDisplayed().assertIsEnabled()
        pressBack()
        compose.onNodeWithTag("coverage.confirm").assertDoesNotExist()
        compose.runOnIdle {
            assertEquals(ShiftCoverageSnapshot.Status.offered, model.coverage.state.value.snapshot!!.cases.single().status)
            assertEquals(null, model.coverage.state.value.pendingCommand)
        }
        pressBack()
        compose.waitUntil(15_000) { model.selectedCaseId == null && !model.coverage.state.value.isBusy }
        show("coverage.case.native-next-delivery")
        compose.onNodeWithTag("coverage.case.native-next-delivery").assertIsDisplayed()
        compose.runOnIdle {
            val current = model.coverage.state.value.snapshot!!.cases.first { it.caseId == "native-market" }
            assertEquals(ShiftCoverageSnapshot.Status.offered, current.status)
            assertEquals(2L, current.revision)
        }
        signOut()
    }

    @Test fun adminCompletionCanBeCancelledWithoutGrantingMemberControlsAtLargeText() {
        start("admin")
        show("coverage.case.native-delivery")
        compose.onNodeWithTag("coverage.case.native-delivery").performClick()
        show("coverage.action.complete")
        compose.onNodeWithTag("coverage.action.complete").assertIsEnabled().performClick()
        compose.onNodeWithTag("coverage.confirm").performScrollTo().assertIsDisplayed().assertIsEnabled()
        pressBack()
        compose.onNodeWithTag("coverage.confirm").assertDoesNotExist()
        compose.runOnIdle {
            assertEquals(ShiftCoverageSnapshot.Status.accepted,
                model.coverage.state.value.snapshot!!.cases.first { it.caseId == "native-delivery" }.status)
        }
        signOut()
        signIn("e")
        show("coverage.case.native-delivery")
        compose.onNodeWithTag("coverage.case.native-delivery").performClick()
        show("coverage.status")
        compose.onNodeWithTag("coverage.status").assertIsDisplayed()
        compose.onNodeWithTag("coverage.action.complete").assertDoesNotExist()
        compose.onNodeWithTag("coverage.action.fail").assertDoesNotExist()
        compose.runOnIdle {
            assertEquals(null, model.coverage.state.value.snapshot!!.cases.first { it.caseId == "native-delivery" }.administration)
        }
        signOut()
    }

    private fun start(member: String) {
        assumeTrue(InstrumentationRegistry.getArguments().getString("hu084Acceptance") == "true")
        compose.runOnIdle { model = CoverageRehearsalViewModel(LocalCoverageRehearsalAccess()) }
        compose.setContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale = 2f)) {
                ReguertaTheme { CoverageScreen(model) }
            }
        }
        signIn(member)
    }

    private fun signIn(member: String) {
        compose.onNodeWithTag("coverage.email").performScrollTo().performTextInput("$member@example.test")
        compose.onNodeWithTag("coverage.password").performScrollTo().performTextInput("local-fixture-password")
        compose.onNodeWithTag("coverage.signIn").performScrollTo().performClick()
        compose.waitUntil(15_000) { model.coverage.state.value.snapshot != null && !model.coverage.state.value.isBusy }
    }

    private fun signOut() {
        show("coverage.signOut")
        compose.onNodeWithTag("coverage.signOut").performClick()
        compose.waitUntil(5_000) { model.coverage.state.value.session == null }
        // The form intentionally retains the address; prepare the next explicit account switch.
        compose.runOnIdle { model.email = "" }
    }

    private fun show(tag: String) {
        compose.onNode(hasScrollAction()).performScrollToNode(hasTestTag(tag))
    }
}
