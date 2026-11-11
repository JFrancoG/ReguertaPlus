package com.reguerta.user.ui.theme

import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Test

class ReguertaAdaptiveProfileTest {
    @Test
    fun `established window profiles preserve spacing controls and typography scales`() {
        assertProfile(CompactProfile, reguertaAdaptiveProfileForWindow(DpSize(360.dp, 800.dp)), "compact phone")
        assertProfile(MediumProfile, reguertaAdaptiveProfileForWindow(DpSize(420.dp, 900.dp)), "medium phone")
        assertProfile(ExpandedProfile, reguertaAdaptiveProfileForWindow(DpSize(800.dp, 1200.dp)), "expanded window")
    }

    @Test
    fun `fractional bounds retain whole dp threshold semantics`() {
        val cases = listOf(
            389.49f to CompactProfile,
            389.5f to MediumProfile,
            390f to MediumProfile,
            390.49f to MediumProfile,
            599.49f to MediumProfile,
            599.5f to ExpandedProfile,
            600f to ExpandedProfile,
            600.49f to ExpandedProfile,
        )

        cases.forEach { (shortEdge, expected) ->
            assertProfile(
                expected,
                reguertaAdaptiveProfileForWindow(DpSize(shortEdge.dp, 1200.dp)),
                "short edge $shortEdge dp",
            )
        }
    }

    @Test
    fun `rotation preserves the shortest edge profile`() {
        val cases = listOf(
            Triple(320, 1200, CompactProfile),
            Triple(420, 900, MediumProfile),
            Triple(600, 960, ExpandedProfile),
        )

        cases.forEach { (shortEdge, longEdge, expected) ->
            assertProfile(
                expected,
                reguertaAdaptiveProfileForWindow(DpSize(shortEdge.dp, longEdge.dp)),
                "portrait short edge $shortEdge dp",
            )
            assertProfile(
                expected,
                reguertaAdaptiveProfileForWindow(DpSize(longEdge.dp, shortEdge.dp)),
                "landscape short edge $shortEdge dp",
            )
        }
    }

    @Test
    fun `window resizing can cross both thresholds and return to compact`() {
        val resizeSequence = listOf(
            DpSize(360.dp, 800.dp) to CompactProfile,
            DpSize(390.dp, 800.dp) to MediumProfile,
            DpSize(800.dp, 600.dp) to ExpandedProfile,
            DpSize(500.dp, 900.dp) to MediumProfile,
            DpSize(320.dp, 700.dp) to CompactProfile,
        )

        resizeSequence.forEach { (windowSize, expected) ->
            assertProfile(expected, reguertaAdaptiveProfileForWindow(windowSize), "resize to $windowSize")
        }
    }

    @Test
    fun `unknown and invalid bounds use neutral scales`() {
        val sizes = listOf(
            DpSize.Unspecified,
            DpSize.Zero,
            DpSize(0.dp, 800.dp),
            DpSize(800.dp, 0.dp),
            DpSize((-1).dp, 800.dp),
            DpSize(800.dp, (-1).dp),
            DpSize(Float.NaN.dp, 800.dp),
            DpSize(800.dp, Float.NaN.dp),
            DpSize(Float.POSITIVE_INFINITY.dp, 800.dp),
            DpSize(800.dp, Float.NEGATIVE_INFINITY.dp),
        )

        sizes.forEach { windowSize ->
            assertProfile(MediumProfile, reguertaAdaptiveProfileForWindow(windowSize), "unavailable bounds $windowSize")
        }
    }

    private fun assertProfile(expected: ExpectedProfile, actual: ReguertaAdaptiveProfile, case: String) {
        assertEquals("$case size class", expected.windowSizeClass, actual.windowSizeClass)
        assertEquals("$case spacing", expected.spacing, actual.tokenScale.spacing, 0f)
        assertEquals("$case radius", expected.radius, actual.tokenScale.radius, 0f)
        assertEquals("$case controls", expected.controls, actual.tokenScale.controls, 0f)
        assertEquals("$case typography", expected.typography, actual.typographyScale, 0f)
    }

    private data class ExpectedProfile(
        val windowSizeClass: ReguertaWindowSizeClass,
        val spacing: Float,
        val radius: Float,
        val controls: Float,
        val typography: Float,
    )

    private companion object {
        val CompactProfile = ExpectedProfile(ReguertaWindowSizeClass.COMPACT, 0.94f, 0.95f, 0.95f, 0.96f)
        val MediumProfile = ExpectedProfile(ReguertaWindowSizeClass.MEDIUM, 1f, 1f, 1f, 1f)
        val ExpandedProfile = ExpectedProfile(ReguertaWindowSizeClass.EXPANDED, 1.14f, 1.10f, 1.10f, 1.14f)
    }
}
