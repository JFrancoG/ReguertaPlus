package com.reguerta.user.presentation.shifts

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import com.reguerta.user.R
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.domain.shifts.ShiftStatus
import com.reguerta.user.domain.shifts.ShiftType
import com.reguerta.user.presentation.root.ShiftSwapDraft
import com.reguerta.user.ui.theme.ReguertaTheme
import java.time.LocalDate
import java.time.ZoneId
import org.junit.Rule
import org.junit.Test

class ShiftBoardAccessibilityTest {
    @get:Rule val compose = createComposeRule()

    @Test fun nextShiftsBoardAndSwapRemainReachableWithLargeText() {
        val member = Member("fixture-member", "Luz del Mercado", normalizedEmail = "luz@example.test",
            authUid = null, roles = emptySet(), isActive = true, producerCatalogEnabled = false)
        val date = LocalDate.now().plusWeeks(2).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val delivery = ShiftAssignment("delivery", ShiftType.DELIVERY, date, listOf(member.id), null,
            ShiftStatus.PLANNED, "fixture", 0, 0)
        val shifts = listOf(delivery, delivery.copy(id = "market", type = ShiftType.MARKET))
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        compose.setContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale = 2f)) {
                ReguertaTheme {
                    var draft by remember { mutableStateOf<ShiftSwapDraft?>(null) }
                    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface).systemBarsPadding()) {
                        Surface(Modifier.size(width = 320.dp, height = 480.dp)) {
                            val current = draft
                            if (current == null) {
                                ShiftsRoute(shifts, emptyList(), emptySet(), emptyMap(), emptyList(), member, listOf(member),
                                    isLoading = false, isUpdatingShiftSwapRequest = false, nowMillis = System.currentTimeMillis(),
                                    onRequestShiftSwap = { draft = ShiftSwapDraft(it) }, onAcceptShiftSwapRequest = { _, _ -> },
                                    onRejectShiftSwapRequest = { _, _ -> }, onCancelShiftSwapRequest = {},
                                    onConfirmShiftSwapRequest = { _, _ -> }, onDismissShiftSwapActivity = {}, onOpenCoverage = {})
                            } else {
                                Box(Modifier.verticalScroll(rememberScrollState())) {
                                    ShiftSwapRequestRoute(current, shifts, emptyList(), listOf(member), isSaving = false,
                                        onDraftChanged = { draft = it }, onCancel = { draft = null },
                                        onSave = { error("This review must not submit a swap") })
                                }
                            }
                        }
                    }
                }
            }
        }

        compose.onNodeWithText(context.getString(R.string.shifts_next_title)).assertIsDisplayed()
        val lead = context.getString(R.string.shifts_next_delivery_lead)
        compose.onNode(hasText("$lead:", substring = true), useUnmergedTree = true).performScrollTo().assertIsDisplayed()
        val market = compose.onNode(hasText(context.getString(R.string.shifts_type_market)) and hasClickAction())
        market.assertIsDisplayed().performClick()
        val swap = compose.onNodeWithText(context.getString(R.string.shift_swap_request_button_label))
        swap.performScrollTo().assertIsDisplayed().performClick()
        compose.onNodeWithText(context.getString(R.string.shift_swap_request_screen_title)).assertIsDisplayed()
        compose.onNodeWithText(context.getString(R.string.shift_swap_request_screen_subtitle)).assertIsDisplayed()
        compose.onNodeWithText(context.getString(R.string.common_action_back)).performScrollTo().assertIsDisplayed().performClick()
        compose.onNodeWithText(context.getString(R.string.shifts_next_title)).assertIsDisplayed()
    }
}
