package com.reguerta.user.ui.components.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
    val dialogTitleStyle = MaterialTheme.typography.headlineMedium.copy(
        fontSize = 24.sp,
        lineHeight = 30.sp,
    )
    val dialogBodyStyle = MaterialTheme.typography.bodyMedium.copy(
        fontSize = 17.sp,
        lineHeight = 24.sp,
    )
    val accentColor = if (type == ReguertaDialogType.ERROR) {
        MaterialTheme.colorScheme.error
    } else {
        MaterialTheme.colorScheme.primary
    }
    val primaryActionTextColor = if (type == ReguertaDialogType.ERROR) {
        MaterialTheme.colorScheme.onError
    } else {
        MaterialTheme.colorScheme.onPrimary
    }
    val dialogShape = RoundedCornerShape(26.dp)
    val dialogTextSecondary = MaterialTheme.colorScheme.onSurfaceVariant

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
                .fillMaxWidth(0.86f)
                .widthIn(max = 336.dp),
            shape = dialogShape,
            color = MaterialTheme.colorScheme.surface,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.65f)),
            tonalElevation = 0.dp,
            shadowElevation = 8.dp,
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = spacing.xxl, vertical = 28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(spacing.lg),
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
                    modifier = Modifier.padding(bottom = spacing.sm),
                    color = dialogTextSecondary,
                    textAlign = TextAlign.Center,
                )

                if (secondaryAction != null) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = spacing.xs),
                        horizontalArrangement = Arrangement.spacedBy(spacing.md, Alignment.CenterHorizontally),
                    ) {
                        DialogActionButton(
                            label = secondaryAction.label,
                            onClick = secondaryAction.onClick,
                            accentColor = accentColor,
                            primaryContentColor = primaryActionTextColor,
                            isPrimary = false,
                            modifier = Modifier.weight(1f),
                        )

                        DialogActionButton(
                            label = primaryAction.label,
                            onClick = primaryAction.onClick,
                            accentColor = accentColor,
                            primaryContentColor = primaryActionTextColor,
                            isPrimary = true,
                            modifier = Modifier.weight(1f),
                        )
                    }
                } else {
                    DialogActionButton(
                        label = primaryAction.label,
                        onClick = primaryAction.onClick,
                        modifier = Modifier.padding(top = 8.dp),
                        accentColor = accentColor,
                        primaryContentColor = primaryActionTextColor,
                        isPrimary = true,
                    )
                }
            }
        }
    }
}

@Composable
private fun DialogActionButton(
    label: String,
    onClick: () -> Unit,
    accentColor: Color,
    primaryContentColor: Color,
    isPrimary: Boolean,
    modifier: Modifier = Modifier,
) {
    val secondaryContainerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.65f)
    val shape = RoundedCornerShape(999.dp)
    val textStyle = MaterialTheme.typography.titleLarge.copy(
        fontSize = 22.sp,
        lineHeight = 28.sp,
    )
    val buttonModifier = modifier
        .fillMaxWidth()
        .defaultMinSize(minHeight = 58.dp)

    if (isPrimary) {
        Button(
            onClick = onClick,
            modifier = buttonModifier,
            shape = shape,
            colors = ButtonDefaults.buttonColors(
                containerColor = accentColor,
                contentColor = primaryContentColor,
            ),
            contentPadding = dialogButtonPadding(),
        ) {
            Text(text = label, style = textStyle, textAlign = TextAlign.Center)
        }
    } else {
        OutlinedButton(
            onClick = onClick,
            modifier = buttonModifier,
            shape = shape,
            border = BorderStroke(1.5.dp, accentColor),
            colors = ButtonDefaults.outlinedButtonColors(
                containerColor = secondaryContainerColor,
                contentColor = accentColor,
            ),
            contentPadding = dialogButtonPadding(),
        ) {
            Text(text = label, style = textStyle, textAlign = TextAlign.Center)
        }
    }
}

private fun dialogButtonPadding() =
    PaddingValues(horizontal = 16.dp, vertical = 10.dp)

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
            .size(104.dp)
            .background(accentColor.copy(alpha = 0.22f), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = contentDescription,
            modifier = Modifier.size(48.dp),
            tint = accentColor,
        )
    }
}
