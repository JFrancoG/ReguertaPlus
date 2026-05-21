package com.reguerta.user.ui.components.auth

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp

private val ReguertaListActionButtonSize = 44.dp

@Composable
fun ReguertaListItemCard(
    modifier: Modifier = Modifier,
    isHighlighted: Boolean = false,
    content: @Composable BoxScope.() -> Unit,
) {
    val shape = RoundedCornerShape(16.dp)
    val highlightAlpha by animateFloatAsState(
        targetValue = if (isHighlighted) 0.9f else 0f,
        label = "listItemHighlightBorderAlpha",
    )
    val containerColor by animateColorAsState(
        targetValue = MaterialTheme.colorScheme.primary.copy(alpha = if (isHighlighted) 0.22f else 0.15f),
        label = "listItemContainerColor",
    )
    val shadowElevation by animateDpAsState(
        targetValue = if (isHighlighted) 10.dp else 0.dp,
        label = "listItemShadowElevation",
    )

    Card(
        modifier = modifier
            .fillMaxWidth()
            .shadow(shadowElevation, shape = shape, clip = false),
        shape = shape,
        colors = CardDefaults.cardColors(containerColor = containerColor),
        border = BorderStroke(3.dp, MaterialTheme.colorScheme.primary.copy(alpha = highlightAlpha)),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        androidx.compose.foundation.layout.Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            content = content,
        )
    }
}

@Composable
fun ReguertaListActionIconButton(
    icon: ImageVector,
    contentDescription: String,
    containerColor: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    IconButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier
            .size(ReguertaListActionButtonSize)
            .clip(RoundedCornerShape(12.dp))
            .background(if (enabled) containerColor else containerColor.copy(alpha = 0.45f)),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = contentDescription,
            tint = Color.White,
        )
    }
}

@Composable
fun ReguertaEditListActionButton(
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    ReguertaListActionIconButton(
        icon = Icons.Default.Edit,
        contentDescription = contentDescription,
        containerColor = MaterialTheme.colorScheme.primary,
        onClick = onClick,
        modifier = modifier,
    )
}

@Composable
fun ReguertaDeleteListActionButton(
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    ReguertaListActionIconButton(
        icon = Icons.Default.Delete,
        contentDescription = contentDescription,
        containerColor = MaterialTheme.colorScheme.error,
        onClick = onClick,
        modifier = modifier,
    )
}
