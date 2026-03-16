package com.reguerta.user.ui.components.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.reguerta.user.ui.theme.ReguertaThemeTokens

enum class ReguertaDialogType {
    INFO,
    ERROR,
}

data class ReguertaDialogAction(
    val label: String,
    val onClick: () -> Unit,
)

@Composable
fun ReguertaDialog(
    type: ReguertaDialogType,
    title: String,
    message: String,
    primaryAction: ReguertaDialogAction,
    secondaryAction: ReguertaDialogAction? = null,
    onDismissRequest: () -> Unit = {},
) {
    val spacing = ReguertaThemeTokens.spacing
    val radius = ReguertaThemeTokens.radius
    val buttonTokens = ReguertaThemeTokens.button
    val accentColor = if (type == ReguertaDialogType.ERROR) {
        MaterialTheme.colorScheme.error
    } else {
        MaterialTheme.colorScheme.primary
    }

    Dialog(
        onDismissRequest = onDismissRequest,
        properties = DialogProperties(
            dismissOnClickOutside = secondaryAction != null,
            dismissOnBackPress = secondaryAction != null,
        ),
    ) {
        Surface(
            shape = RoundedCornerShape(radius.lg),
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 2.dp,
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(spacing.lg),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(spacing.md),
            ) {
                DialogIcon(type = type, accentColor = accentColor)

                Text(
                    text = title,
                    style = MaterialTheme.typography.headlineSmall,
                    color = MaterialTheme.colorScheme.onSurface,
                    textAlign = TextAlign.Center,
                )

                Text(
                    text = message,
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(spacing.sm, Alignment.CenterHorizontally),
                ) {
                    if (secondaryAction != null) {
                        ReguertaButton(
                            label = secondaryAction.label,
                            onClick = secondaryAction.onClick,
                            variant = ReguertaButtonVariant.SECONDARY,
                            fullWidth = false,
                            modifier = Modifier.width(buttonTokens.dialogTwoButtonsWidth),
                        )
                    }

                    ReguertaButton(
                        label = primaryAction.label,
                        onClick = primaryAction.onClick,
                        variant = if (type == ReguertaDialogType.ERROR) {
                            ReguertaButtonVariant.DESTRUCTIVE
                        } else {
                            ReguertaButtonVariant.PRIMARY
                        },
                        fullWidth = false,
                        modifier = Modifier.width(
                            if (secondaryAction != null) {
                                buttonTokens.dialogTwoButtonsWidth
                            } else {
                                buttonTokens.dialogSingleButtonWidth
                            },
                        ),
                    )
                }
            }
        }
    }
}

@Composable
private fun DialogIcon(
    type: ReguertaDialogType,
    accentColor: Color,
) {
    val iconLabel = if (type == ReguertaDialogType.ERROR) "!" else "i"

    Box(
        modifier = Modifier
            .size(88.dp)
            .background(accentColor.copy(alpha = 0.22f), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .background(accentColor, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = iconLabel,
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onPrimary,
            )
        }
    }
}
