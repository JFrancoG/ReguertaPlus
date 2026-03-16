package com.reguerta.user.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.max

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
data class ReguertaButtonTokens(
    val minHeight: Dp = 56.dp,
    val cornerRadius: Dp = 24.dp,
    val horizontalPadding: Dp = 24.dp,
    val verticalPadding: Dp = 12.dp,
    val progressSize: Dp = 18.dp,
    val dialogSingleButtonWidth: Dp = 296.dp,
    val dialogTwoButtonsWidth: Dp = 140.dp,
)

@Immutable
data class ReguertaTokens(
    val spacing: ReguertaSpacingTokens = ReguertaSpacingTokens(),
    val radius: ReguertaRadiusTokens = ReguertaRadiusTokens(),
    val elevation: ReguertaElevationTokens = ReguertaElevationTokens(),
    val button: ReguertaButtonTokens = ReguertaButtonTokens(),
)

@Immutable
data class ReguertaTokenScale(
    val spacing: Float = 1f,
    val radius: Float = 1f,
    val controls: Float = 1f,
)

internal val LocalReguertaTokens = staticCompositionLocalOf { ReguertaTokens() }

internal fun ReguertaTokens.scaled(scale: ReguertaTokenScale): ReguertaTokens =
    copy(
        spacing = spacing.scaled(scale.spacing),
        radius = radius.scaled(scale.radius),
        button = button.scaled(scale.controls),
    )

private fun ReguertaSpacingTokens.scaled(factor: Float): ReguertaSpacingTokens =
    copy(
        xs = xs.scaleBy(factor),
        sm = sm.scaleBy(factor),
        md = md.scaleBy(factor),
        lg = lg.scaleBy(factor),
        xl = xl.scaleBy(factor),
        xxl = xxl.scaleBy(factor),
    )

private fun ReguertaRadiusTokens.scaled(factor: Float): ReguertaRadiusTokens =
    copy(
        sm = sm.scaleBy(factor),
        md = md.scaleBy(factor),
        lg = lg.scaleBy(factor),
    )

private fun ReguertaButtonTokens.scaled(factor: Float): ReguertaButtonTokens =
    copy(
        minHeight = minHeight.scaleBy(factor),
        cornerRadius = cornerRadius.scaleBy(factor),
        horizontalPadding = horizontalPadding.scaleBy(factor),
        verticalPadding = verticalPadding.scaleBy(factor),
        progressSize = progressSize.scaleBy(factor),
        dialogSingleButtonWidth = dialogSingleButtonWidth.scaleBy(factor),
        dialogTwoButtonsWidth = dialogTwoButtonsWidth.scaleBy(factor),
    )

private fun Dp.scaleBy(factor: Float): Dp = max(value * factor, 0f).dp

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

    val button: ReguertaButtonTokens
        @Composable
        @ReadOnlyComposable
        get() = LocalReguertaTokens.current.button
}
