package com.reguerta.user.ui.components.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.reguerta.user.ui.theme.ReguertaThemeTokens

enum class ReguertaButtonVariant {
    PRIMARY,
    SECONDARY,
    DESTRUCTIVE,
    TEXT,
}

@Composable
fun ReguertaButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: ReguertaButtonVariant = ReguertaButtonVariant.PRIMARY,
    textStyle: TextStyle? = null,
    cornerRadius: Dp? = null,
    enabled: Boolean = true,
    fullWidth: Boolean = true,
    loading: Boolean = false,
) {
    val buttonModifier = if (fullWidth) modifier.fillMaxWidth() else modifier
    val isEnabled = enabled && !loading
    val spacing = ReguertaThemeTokens.spacing
    val buttonTokens = ReguertaThemeTokens.button
    val contentColor = if (variant == ReguertaButtonVariant.PRIMARY) {
        MaterialTheme.colorScheme.onPrimary
    } else if (variant == ReguertaButtonVariant.DESTRUCTIVE) {
        MaterialTheme.colorScheme.onError
    } else {
        MaterialTheme.colorScheme.primary
    }

    val content: @Composable RowScope.() -> Unit = {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(spacing.sm),
        ) {
            if (loading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(buttonTokens.progressSize),
                    strokeWidth = buttonTokens.progressSize / 8,
                    color = contentColor,
                )
            }
            Text(
                text = label,
                style = textStyle ?: if (variant == ReguertaButtonVariant.TEXT) {
                    MaterialTheme.typography.titleMedium
                } else {
                    MaterialTheme.typography.titleLarge
                },
            )
        }
    }
    val shape = RoundedCornerShape(cornerRadius ?: buttonTokens.cornerRadius)

    when (variant) {
        ReguertaButtonVariant.PRIMARY -> Button(
            onClick = onClick,
            modifier = buttonModifier.defaultMinSize(minHeight = buttonTokens.minHeight),
            enabled = isEnabled,
            shape = shape,
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
                disabledContainerColor = MaterialTheme.colorScheme.surfaceContainerHigh,
                disabledContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
            ),
            contentPadding = PaddingValues(
                horizontal = buttonTokens.horizontalPadding,
                vertical = buttonTokens.verticalPadding,
            ),
            content = content,
        )

        ReguertaButtonVariant.SECONDARY -> OutlinedButton(
            onClick = onClick,
            modifier = buttonModifier.defaultMinSize(minHeight = buttonTokens.minHeight),
            enabled = isEnabled,
            shape = shape,
            contentPadding = PaddingValues(
                horizontal = buttonTokens.horizontalPadding,
                vertical = buttonTokens.verticalPadding,
            ),
            content = content,
        )

        ReguertaButtonVariant.DESTRUCTIVE -> Button(
            onClick = onClick,
            modifier = buttonModifier.defaultMinSize(minHeight = buttonTokens.minHeight),
            enabled = isEnabled,
            shape = shape,
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.error,
                contentColor = MaterialTheme.colorScheme.onError,
                disabledContainerColor = MaterialTheme.colorScheme.surfaceContainerHigh,
                disabledContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
            ),
            contentPadding = PaddingValues(
                horizontal = buttonTokens.horizontalPadding,
                vertical = buttonTokens.verticalPadding,
            ),
            content = content,
        )

        ReguertaButtonVariant.TEXT -> TextButton(
            onClick = onClick,
            modifier = buttonModifier,
            enabled = isEnabled,
            content = content,
        )
    }
}

@Composable
fun ReguertaFullButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    fullWidth: Boolean = false,
    loading: Boolean = false,
    textStyle: TextStyle? = null,
) {
    ReguertaButton(
        label = label,
        onClick = onClick,
        modifier = modifier.defaultMinSize(minHeight = ReguertaThemeTokens.button.minHeight),
        variant = ReguertaButtonVariant.PRIMARY,
        textStyle = textStyle,
        cornerRadius = 999.dp,
        enabled = enabled,
        fullWidth = fullWidth,
        loading = loading,
    )
}

@Composable
fun ReguertaFlatButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    textStyle: TextStyle? = null,
) {
    ReguertaButton(
        label = label,
        onClick = onClick,
        modifier = modifier,
        variant = ReguertaButtonVariant.TEXT,
        textStyle = textStyle,
        cornerRadius = ReguertaThemeTokens.button.cornerRadius,
        enabled = enabled,
        fullWidth = false,
        loading = false,
    )
}
