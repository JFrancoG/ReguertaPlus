package com.reguerta.user.ui.theme

import androidx.compose.ui.graphics.Color
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

class ReguertaColorContrastTest {
    @Test
    fun `semantic text pairs meet WCAG AA in light and dark`() {
        currentPalettes().forEach { palette ->
            textCases(palette).forEach { contrastCase ->
                assertTrue(
                    "${palette.name} ${contrastCase.name} was ${contrastCase.ratio}:1",
                    contrastCase.ratio >= MinimumTextContrast,
                )
            }
        }
    }

    @Test
    fun `semantic control pairs meet WCAG AA in light and dark`() {
        currentPalettes().forEach { palette ->
            listOf(
                ContrastCase(
                    name = "action component on primary surface",
                    ratio = contrastRatio(palette.action, palette.primarySurface),
                ),
                ContrastCase(
                    name = "action component on secondary surface",
                    ratio = contrastRatio(palette.action, palette.secondarySurface),
                ),
            ).forEach { contrastCase ->
                assertTrue(
                    "${palette.name} ${contrastCase.name} was ${contrastCase.ratio}:1",
                    contrastCase.ratio >= MinimumNonTextContrast,
                )
            }
        }
    }

    private fun currentPalettes(): List<ContrastPalette> = listOf(
        ContrastPalette(
            name = "light",
            action = ColorActionPrimaryDefaultLight,
            onAction = ColorActionOnPrimaryLight,
            primarySurface = ColorSurfacePrimaryDefaultLight,
            secondarySurface = ColorSurfaceSecondaryDefaultLight,
            primaryText = ColorTextPrimaryDefaultLight,
            warning = ColorFeedbackWarningDefaultLight,
            error = ColorFeedbackErrorDefaultLight,
            onError = ColorActionOnPrimaryLight,
        ),
        ContrastPalette(
            name = "dark",
            action = ColorActionPrimaryDefaultDark,
            onAction = ColorActionOnPrimaryDark,
            primarySurface = ColorSurfacePrimaryDefaultDark,
            secondarySurface = ColorSurfaceSecondaryDefaultDark,
            primaryText = ColorTextPrimaryDefaultDark,
            warning = ColorFeedbackWarningDefaultDark,
            error = ColorFeedbackErrorDefaultDark,
            onError = ColorActionOnPrimaryDark,
        ),
    )

    private fun textCases(palette: ContrastPalette): List<ContrastCase> = listOf(
        ContrastCase(
            name = "action on primary surface",
            ratio = contrastRatio(palette.action, palette.primarySurface),
        ),
        ContrastCase(
            name = "action on secondary surface",
            ratio = contrastRatio(palette.action, palette.secondarySurface),
        ),
        ContrastCase(
            name = "content on action",
            ratio = contrastRatio(palette.onAction, palette.action),
        ),
        ContrastCase(
            name = "pressed content on action",
            ratio = contrastRatio(
                palette.onAction,
                palette.onAction.compositedOver(palette.action, alpha = PressedStateLayerAlpha),
            ),
        ),
        ContrastCase(
            name = "action on tinted primary surface",
            ratio = contrastRatio(
                palette.action,
                palette.action.compositedOver(palette.primarySurface, alpha = MaximumActionTintAlpha),
            ),
        ),
        ContrastCase(
            name = "disabled content on secondary surface",
            ratio = contrastRatio(palette.primaryText, palette.secondarySurface),
        ),
        ContrastCase(
            name = "warning on primary surface",
            ratio = contrastRatio(palette.warning, palette.primarySurface),
        ),
        ContrastCase(
            name = "warning on secondary surface",
            ratio = contrastRatio(palette.warning, palette.secondarySurface),
        ),
        ContrastCase(
            name = "error on primary surface",
            ratio = contrastRatio(palette.error, palette.primarySurface),
        ),
        ContrastCase(
            name = "error on secondary surface",
            ratio = contrastRatio(palette.error, palette.secondarySurface),
        ),
        ContrastCase(
            name = "content on error",
            ratio = contrastRatio(palette.onError, palette.error),
        ),
        ContrastCase(
            name = "pressed content on error",
            ratio = contrastRatio(
                palette.onError,
                palette.onError.compositedOver(palette.error, alpha = PressedStateLayerAlpha),
            ),
        ),
    )

    private fun contrastRatio(first: Color, second: Color): Double {
        val lighter = max(first.relativeLuminance(), second.relativeLuminance())
        val darker = min(first.relativeLuminance(), second.relativeLuminance())
        return (lighter + 0.05) / (darker + 0.05)
    }

    private fun Color.relativeLuminance(): Double =
        0.2126 * red.toDouble().linearized() +
            0.7152 * green.toDouble().linearized() +
            0.0722 * blue.toDouble().linearized()

    private fun Color.compositedOver(background: Color, alpha: Double): Color = Color(
        red = (alpha * red + (1 - alpha) * background.red).toFloat(),
        green = (alpha * green + (1 - alpha) * background.green).toFloat(),
        blue = (alpha * blue + (1 - alpha) * background.blue).toFloat(),
        alpha = 1f,
    )

    private fun Double.linearized(): Double =
        if (this <= 0.04045) this / 12.92 else ((this + 0.055) / 1.055).pow(2.4)

    private data class ContrastPalette(
        val name: String,
        val action: Color,
        val onAction: Color,
        val primarySurface: Color,
        val secondarySurface: Color,
        val primaryText: Color,
        val warning: Color,
        val error: Color,
        val onError: Color,
    )

    private data class ContrastCase(
        val name: String,
        val ratio: Double,
    )

    private companion object {
        const val MinimumTextContrast = 4.5
        const val MinimumNonTextContrast = 3.0
        const val PressedStateLayerAlpha = 0.12
        const val MaximumActionTintAlpha = 0.16
    }
}
