package com.reguerta.user.ui.components.auth

import org.junit.Assert.assertEquals
import org.junit.Test

class ReguertaDialogLayoutPolicyTest {
    @Test
    fun `compact labels remain horizontal at default font scale`() {
        assertEquals(
            ReguertaDialogActionLayout.Horizontal,
            resolveReguertaDialogActionLayout(
                availableWidthDp = 288f,
                fontScale = 1f,
                primaryLabelLength = "Retry".length,
                secondaryLabelLength = "Continue".length,
            ),
        )
    }

    @Test
    fun `large font scale stacks actions`() {
        assertEquals(
            ReguertaDialogActionLayout.Stacked,
            resolveReguertaDialogActionLayout(
                availableWidthDp = 288f,
                fontScale = 1.3f,
                primaryLabelLength = "Retry".length,
                secondaryLabelLength = "Continue".length,
            ),
        )
    }

    @Test
    fun `narrow width stacks actions`() {
        assertEquals(
            ReguertaDialogActionLayout.Stacked,
            resolveReguertaDialogActionLayout(
                availableWidthDp = 260f,
                fontScale = 1f,
                primaryLabelLength = "Retry".length,
                secondaryLabelLength = "Continue".length,
            ),
        )
    }

    @Test
    fun `long localized labels stack before clipping`() {
        assertEquals(
            ReguertaDialogActionLayout.Stacked,
            resolveReguertaDialogActionLayout(
                availableWidthDp = 288f,
                fontScale = 1f,
                primaryLabelLength = 18,
                secondaryLabelLength = 16,
            ),
        )
    }
}
