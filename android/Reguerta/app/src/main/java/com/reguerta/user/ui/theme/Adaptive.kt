package com.reguerta.user.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.platform.LocalConfiguration
import kotlin.math.min

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

internal val LocalReguertaAdaptiveProfile = staticCompositionLocalOf {
    ReguertaAdaptiveProfile(
        windowSizeClass = ReguertaWindowSizeClass.MEDIUM,
        tokenScale = ReguertaTokenScale(),
        typographyScale = 1f,
    )
}

@Composable
internal fun rememberReguertaAdaptiveProfile(): ReguertaAdaptiveProfile {
    val configuration = LocalConfiguration.current
    val shortEdgeDp = min(configuration.screenWidthDp, configuration.screenHeightDp)

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

        ReguertaWindowSizeClass.MEDIUM -> ReguertaAdaptiveProfile(
            windowSizeClass = windowSizeClass,
            tokenScale = ReguertaTokenScale(),
            typographyScale = 1f,
        )

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
