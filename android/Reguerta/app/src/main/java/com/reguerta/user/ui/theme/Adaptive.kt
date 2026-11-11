package com.reguerta.user.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.isSpecified
import kotlin.math.min
import kotlin.math.roundToInt

internal enum class ReguertaWindowSizeClass {
    COMPACT,
    MEDIUM,
    EXPANDED,
}

@Immutable
internal data class ReguertaAdaptiveProfile(
    val windowSizeClass: ReguertaWindowSizeClass,
    val tokenScale: ReguertaTokenScale,
    val typographyScale: Float,
)

private val DefaultAdaptiveProfile = ReguertaAdaptiveProfile(
    windowSizeClass = ReguertaWindowSizeClass.MEDIUM,
    tokenScale = ReguertaTokenScale(),
    typographyScale = 1f,
)

internal val LocalReguertaAdaptiveProfile = staticCompositionLocalOf { DefaultAdaptiveProfile }

@Composable
internal fun rememberReguertaAdaptiveProfile(): ReguertaAdaptiveProfile =
    reguertaAdaptiveProfileForWindow(LocalWindowInfo.current.containerDpSize)

/**
 * Keep the established whole-dp shortest-edge breakpoints as the window resizes.
 * Fractional dp rounds to the nearest integer, with half-dp ties rounding up.
 * Unavailable or invalid bounds use neutral scales until the window is known.
 */
internal fun reguertaAdaptiveProfileForWindow(windowSize: DpSize): ReguertaAdaptiveProfile {
    if (!windowSize.isSpecified) return DefaultAdaptiveProfile
    val widthDp = windowSize.width.value
    val heightDp = windowSize.height.value
    if (!widthDp.isFinite() || !heightDp.isFinite() || widthDp <= 0f || heightDp <= 0f) {
        return DefaultAdaptiveProfile
    }
    val shortEdgeDp = min(widthDp, heightDp).roundToInt()

    val windowSizeClass = when {
        shortEdgeDp >= 600 -> ReguertaWindowSizeClass.EXPANDED
        shortEdgeDp < 390 -> ReguertaWindowSizeClass.COMPACT
        else -> ReguertaWindowSizeClass.MEDIUM
    }

    return when (windowSizeClass) {
        ReguertaWindowSizeClass.COMPACT -> ReguertaAdaptiveProfile(
            windowSizeClass = windowSizeClass,
            tokenScale = ReguertaTokenScale(
                spacing = 0.94f,
                radius = 0.95f,
                controls = 0.95f,
            ),
            typographyScale = 0.96f,
        )

        ReguertaWindowSizeClass.MEDIUM -> DefaultAdaptiveProfile

        ReguertaWindowSizeClass.EXPANDED -> ReguertaAdaptiveProfile(
            windowSizeClass = windowSizeClass,
            tokenScale = ReguertaTokenScale(
                spacing = 1.14f,
                radius = 1.10f,
                controls = 1.10f,
            ),
            typographyScale = 1.14f,
        )
    }
}

internal object ReguertaAdaptive {
    val profile: ReguertaAdaptiveProfile
        @Composable
        @ReadOnlyComposable
        get() = LocalReguertaAdaptiveProfile.current
}
