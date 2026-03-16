package com.reguerta.user.ui.components.auth

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.reguerta.user.R
import com.reguerta.user.ui.theme.ReguertaAdaptive
import com.reguerta.user.ui.theme.ReguertaThemeTokens

enum class ReguertaInputState {
    DEFAULT,
    FOCUSED,
    ERROR,
    DISABLED,
}

@Composable
fun ReguertaInputField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    helperMessage: String? = null,
    enabled: Boolean = true,
    keyboardType: KeyboardType = KeyboardType.Text,
    errorMessage: String? = null,
    liveValidationErrorMessage: String? = null,
    liveValidation: ((String) -> Boolean)? = null,
    liveValidationErrorProvider: ((String) -> String?)? = null,
    isPassword: Boolean = false,
    showClearAction: Boolean = false,
    showPasswordToggle: Boolean = isPassword,
    passwordVisible: Boolean? = null,
    onPasswordVisibilityChange: ((Boolean) -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
) {
    var focused by remember { mutableStateOf(false) }
    var interacted by remember { mutableStateOf(false) }
    var internalPasswordVisible by remember { mutableStateOf(false) }
    val resolvedPasswordVisible = passwordVisible ?: internalPasswordVisible
    val controlScale = ReguertaAdaptive.profile.tokenScale.controls
    val spacing = ReguertaThemeTokens.spacing
    val trailingIconSize: Dp = (24f * controlScale).dp
    val liveErrorMessage = when {
        !enabled -> null
        !interacted -> null
        liveValidationErrorProvider != null -> liveValidationErrorProvider(value)
        liveValidation == null -> null
        liveValidationErrorMessage.isNullOrBlank() -> null
        liveValidation(value) -> null
        else -> liveValidationErrorMessage
    }
    val effectiveErrorMessage = errorMessage ?: liveErrorMessage
    val hasError = !effectiveErrorMessage.isNullOrBlank()
    val state = when {
        !enabled -> ReguertaInputState.DISABLED
        hasError -> ReguertaInputState.ERROR
        focused -> ReguertaInputState.FOCUSED
        else -> ReguertaInputState.DEFAULT
    }

    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(spacing.xs),
    ) {
        Text(
            text = label.uppercase(),
            style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold),
            color = labelColor(state),
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .padding(vertical = 2.dp),
            ) {
                if (value.isEmpty() && !placeholder.isNullOrBlank()) {
                    Text(
                        text = placeholder,
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.55f),
                    )
                }

                BasicTextField(
                    value = value,
                    onValueChange = {
                        interacted = true
                        onValueChange(it)
                    },
                    enabled = enabled,
                    singleLine = true,
                    textStyle = MaterialTheme.typography.bodyLarge.copy(color = MaterialTheme.colorScheme.onSurface),
                    keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
                    visualTransformation = if (isPassword && !resolvedPasswordVisible) {
                        PasswordVisualTransformation()
                    } else {
                        VisualTransformation.None
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .onFocusChanged {
                            focused = it.isFocused
                            if (it.isFocused) {
                                interacted = true
                            }
                        },
                )
            }

            when {
                isPassword && showPasswordToggle -> {
                    IconButton(
                        onClick = {
                            val next = !resolvedPasswordVisible
                            if (onPasswordVisibilityChange != null) {
                                onPasswordVisibilityChange(next)
                            } else {
                                internalPasswordVisible = next
                            }
                        },
                        enabled = enabled,
                    ) {
                        Icon(
                            imageVector = if (resolvedPasswordVisible) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                            contentDescription = if (resolvedPasswordVisible) {
                                stringResource(R.string.common_action_hide_password)
                            } else {
                                stringResource(R.string.common_action_show_password)
                            },
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(trailingIconSize),
                        )
                    }
                }

                showClearAction && enabled -> {
                    IconButton(onClick = {
                        interacted = true
                        if (value.isNotEmpty()) {
                            onValueChange("")
                        }
                    }) {
                        Icon(
                            imageVector = Icons.Filled.Close,
                            contentDescription = stringResource(R.string.common_action_clear),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(trailingIconSize),
                        )
                    }
                }

                trailing != null -> trailing()
            }
        }

        HorizontalDivider(color = lineColor(state), thickness = 1.dp)

        if (!effectiveErrorMessage.isNullOrBlank()) {
            Text(
                text = effectiveErrorMessage,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(horizontal = spacing.xs),
            )
        } else if (!helperMessage.isNullOrBlank()) {
            Text(
                text = helperMessage,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = spacing.xs),
            )
        }
    }
}

@Composable
private fun lineColor(state: ReguertaInputState) =
    when (state) {
        ReguertaInputState.DEFAULT -> MaterialTheme.colorScheme.onSurfaceVariant
        ReguertaInputState.FOCUSED -> MaterialTheme.colorScheme.primary
        ReguertaInputState.ERROR -> MaterialTheme.colorScheme.error
        ReguertaInputState.DISABLED -> MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
    }

@Composable
private fun labelColor(state: ReguertaInputState): Color =
    when (state) {
        ReguertaInputState.DEFAULT -> MaterialTheme.colorScheme.onSurfaceVariant
        ReguertaInputState.FOCUSED -> MaterialTheme.colorScheme.primary
        ReguertaInputState.ERROR -> MaterialTheme.colorScheme.error
        ReguertaInputState.DISABLED -> MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
    }
