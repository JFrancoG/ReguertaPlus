package com.reguerta.user.ui.components.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.reguerta.user.ui.theme.ReguertaThemeTokens

enum class ReguertaButtonVariant {
    PRIMARY,
    SECONDARY,
    TEXT,
}

@Composable
fun ReguertaButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: ReguertaButtonVariant = ReguertaButtonVariant.PRIMARY,
    enabled: Boolean = true,
    fullWidth: Boolean = true,
    loading: Boolean = false,
) {
    val buttonModifier = if (fullWidth) modifier.fillMaxWidth() else modifier
    val isEnabled = enabled && !loading
    val spacing = ReguertaThemeTokens.spacing

    val content: @Composable RowScope.() -> Unit = {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(spacing.sm),
        ) {
            if (loading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(16.dp),
                    strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.onPrimary,
                )
            }
            Text(label)
        }
    }

    when (variant) {
        ReguertaButtonVariant.PRIMARY -> Button(
            onClick = onClick,
            modifier = buttonModifier,
            enabled = isEnabled,
            content = content,
        )

        ReguertaButtonVariant.SECONDARY -> OutlinedButton(
            onClick = onClick,
            modifier = buttonModifier,
            enabled = isEnabled,
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
