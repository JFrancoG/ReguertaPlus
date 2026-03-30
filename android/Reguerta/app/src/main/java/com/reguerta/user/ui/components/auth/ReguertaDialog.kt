package com.reguerta.user.ui.components.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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
    dismissible: Boolean = secondaryAction != null,
    onDismissRequest: () -> Unit = {},
) {
    val spacing = ReguertaThemeTokens.spacing
    val radius = ReguertaThemeTokens.radius
    val buttonTokens = ReguertaThemeTokens.button
    val dialogTitleStyle = MaterialTheme.typography.headlineMedium.copy(
        fontSize = 20.sp,
        lineHeight = 26.sp,
    )
    val dialogBodyStyle = MaterialTheme.typography.bodyMedium.copy(
        fontSize = 13.sp,
        lineHeight = 18.sp,
    )
    val accentColor = if (type == ReguertaDialogType.ERROR) {
        MaterialTheme.colorScheme.error
    } else {
        MaterialTheme.colorScheme.primary
    }

    Dialog(
        onDismissRequest = onDismissRequest,
        properties = DialogProperties(
            dismissOnClickOutside = dismissible,
            dismissOnBackPress = dismissible,
            usePlatformDefaultWidth = false,
        ),
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth(0.92f)
                .widthIn(max = 360.dp),
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
                    style = dialogTitleStyle,
                    color = MaterialTheme.colorScheme.onSurface,
                    textAlign = TextAlign.Center,
                )

                Text(
                    text = message,
                    style = dialogBodyStyle,
                    modifier = Modifier.padding(top = 4.dp, bottom = 8.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )

                if (secondaryAction != null) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(spacing.sm, Alignment.CenterHorizontally),
                    ) {
                        ReguertaButton(
                            label = secondaryAction.label,
                            onClick = secondaryAction.onClick,
                            variant = ReguertaButtonVariant.SECONDARY,
                            fullWidth = false,
                            modifier = Modifier.width(buttonTokens.dialogTwoButtonsWidth),
                        )

                        ReguertaButton(
                            label = primaryAction.label,
                            onClick = primaryAction.onClick,
                            variant = if (type == ReguertaDialogType.ERROR) {
                                ReguertaButtonVariant.DESTRUCTIVE
                            } else {
                                ReguertaButtonVariant.PRIMARY
                            },
                            fullWidth = false,
                            modifier = Modifier.width(buttonTokens.dialogTwoButtonsWidth),
                        )
                    }
                } else {
                    ReguertaButton(
                        label = primaryAction.label,
                        onClick = primaryAction.onClick,
                        variant = if (type == ReguertaDialogType.ERROR) {
                            ReguertaButtonVariant.DESTRUCTIVE
                        } else {
                            ReguertaButtonVariant.PRIMARY
                        },
                        modifier = Modifier.padding(top = 8.dp),
                        fullWidth = true,
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
    val icon = if (type == ReguertaDialogType.ERROR) {
        Icons.Filled.Error
    } else {
        Icons.Filled.Info
    }
    val contentDescription = if (type == ReguertaDialogType.ERROR) "Error" else "Information"

    Box(
        modifier = Modifier
            .size(88.dp)
            .background(accentColor.copy(alpha = 0.22f), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = contentDescription,
            modifier = Modifier.size(38.dp),
            tint = accentColor,
        )
    }
}
