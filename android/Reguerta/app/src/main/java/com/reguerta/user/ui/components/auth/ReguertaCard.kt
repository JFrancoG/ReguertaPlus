package com.reguerta.user.ui.components.auth

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.foundation.shape.RoundedCornerShape
import com.reguerta.user.ui.theme.ReguertaThemeTokens

@Composable
fun ReguertaCard(
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit,
) {
    val spacing = ReguertaThemeTokens.spacing
    val radius = ReguertaThemeTokens.radius
    val elevation = ReguertaThemeTokens.elevation

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(radius.md),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = elevation.level1),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(spacing.lg),
            content = content,
        )
    }
}
