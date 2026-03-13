package com.reguerta.user.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

@Immutable
data class ReguertaSpacingTokens(
    val xs: Dp = 4.dp,
    val sm: Dp = 8.dp,
    val md: Dp = 12.dp,
    val lg: Dp = 16.dp,
    val xl: Dp = 20.dp,
    val xxl: Dp = 24.dp,
)

@Immutable
data class ReguertaRadiusTokens(
    val sm: Dp = 10.dp,
    val md: Dp = 14.dp,
    val lg: Dp = 18.dp,
)

@Immutable
data class ReguertaElevationTokens(
    val level0: Dp = 0.dp,
    val level1: Dp = 1.dp,
    val level2: Dp = 2.dp,
)

@Immutable
data class ReguertaTokens(
    val spacing: ReguertaSpacingTokens = ReguertaSpacingTokens(),
    val radius: ReguertaRadiusTokens = ReguertaRadiusTokens(),
    val elevation: ReguertaElevationTokens = ReguertaElevationTokens(),
)

internal val LocalReguertaTokens = staticCompositionLocalOf { ReguertaTokens() }

object ReguertaThemeTokens {
    val spacing: ReguertaSpacingTokens
        @Composable
        @ReadOnlyComposable
        get() = LocalReguertaTokens.current.spacing

    val radius: ReguertaRadiusTokens
        @Composable
        @ReadOnlyComposable
        get() = LocalReguertaTokens.current.radius

    val elevation: ReguertaElevationTokens
        @Composable
        @ReadOnlyComposable
        get() = LocalReguertaTokens.current.elevation
}
