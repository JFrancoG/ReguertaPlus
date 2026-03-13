package com.reguerta.user.ui.components.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import com.reguerta.user.ui.theme.ReguertaThemeTokens

enum class ReguertaFeedbackKind {
    INFO,
    WARNING,
    ERROR,
}

@Composable
fun ReguertaInlineFeedback(
    message: String,
    modifier: Modifier = Modifier,
    kind: ReguertaFeedbackKind = ReguertaFeedbackKind.ERROR,
) {
    val spacing = ReguertaThemeTokens.spacing
    val color = when (kind) {
        ReguertaFeedbackKind.INFO -> MaterialTheme.colorScheme.onSurface
        ReguertaFeedbackKind.WARNING -> MaterialTheme.colorScheme.tertiary
        ReguertaFeedbackKind.ERROR -> MaterialTheme.colorScheme.error
    }
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = "•",
            color = color,
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = FontWeight.Bold,
        )
        Text(
            text = message,
            color = color,
            style = MaterialTheme.typography.bodySmall,
        )
    }
}
