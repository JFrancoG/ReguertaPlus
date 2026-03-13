package com.reguerta.user.ui.components.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.text.input.KeyboardType
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
    trailing: (@Composable () -> Unit)? = null,
) {
    var focused by remember { mutableStateOf(false) }
    val spacing = ReguertaThemeTokens.spacing
    val hasError = !errorMessage.isNullOrBlank()
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
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            enabled = enabled,
            modifier = Modifier
                .fillMaxWidth()
                .onFocusChanged { focused = it.isFocused },
            label = { Text(label) },
            placeholder = placeholder?.let { text ->
                { Text(text) }
            },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            trailingIcon = trailing,
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = stateBorderColor(ReguertaInputState.FOCUSED),
                unfocusedBorderColor = stateBorderColor(ReguertaInputState.DEFAULT),
                errorBorderColor = stateBorderColor(ReguertaInputState.ERROR),
                disabledBorderColor = stateBorderColor(ReguertaInputState.DISABLED),
                focusedLabelColor = stateBorderColor(state),
                errorLabelColor = stateBorderColor(ReguertaInputState.ERROR),
                disabledLabelColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.45f),
            ),
            isError = hasError,
        )

        if (hasError) {
            Text(
                text = errorMessage.orEmpty(),
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
private fun stateBorderColor(state: ReguertaInputState) =
    when (state) {
        ReguertaInputState.DEFAULT -> MaterialTheme.colorScheme.outline
        ReguertaInputState.FOCUSED -> MaterialTheme.colorScheme.primary
        ReguertaInputState.ERROR -> MaterialTheme.colorScheme.error
        ReguertaInputState.DISABLED -> MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
    }
