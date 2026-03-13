package com.reguerta.user.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalContext

private val DarkColorScheme = darkColorScheme(
    primary = ColorActionPrimaryDefaultDark,
    onPrimary = ColorActionOnPrimary,
    secondary = ColorSurfaceSecondaryDefaultDark,
    tertiary = ColorFeedbackWarningDefault,
    background = ColorSurfacePrimaryDefaultDark,
    surface = ColorSurfacePrimaryDefaultDark,
    onBackground = ColorTextPrimaryDefaultDark,
    onSurface = ColorTextPrimaryDefaultDark,
    error = ColorFeedbackErrorDefault,
    outline = ColorBorderSubtleDark,
)

private val LightColorScheme = lightColorScheme(
    primary = ColorActionPrimaryDefaultLight,
    onPrimary = ColorActionOnPrimary,
    secondary = ColorSurfaceSecondaryDefaultLight,
    tertiary = ColorFeedbackWarningDefault,
    background = ColorSurfacePrimaryDefaultLight,
    surface = ColorSurfacePrimaryDefaultLight,
    onBackground = ColorTextPrimaryDefaultLight,
    onSurface = ColorTextPrimaryDefaultLight,
    error = ColorFeedbackErrorDefault,
    outline = ColorBorderSubtleLight,
)

@Composable
fun ReguertaTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    // Keep explicit app branding by default; can be enabled if product decides.
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit,
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }

        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    val tokens = ReguertaTokens()

    CompositionLocalProvider(LocalReguertaTokens provides tokens) {
        MaterialTheme(
            colorScheme = colorScheme.withSemanticSurfaceDefaults(),
            typography = ReguertaTypography,
            content = content,
        )
    }
}

private fun ColorScheme.withSemanticSurfaceDefaults(): ColorScheme =
    copy(
        surfaceVariant = secondary,
        onSurfaceVariant = onSurface,
        surfaceContainer = surface,
        surfaceContainerHigh = secondary,
        surfaceContainerLowest = surface,
    )
