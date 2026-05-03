package com.reguerta.user.presentation.access

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.reguerta.user.R
import com.reguerta.user.ui.theme.ColorFeedbackWarningDefault
import com.reguerta.user.ui.theme.ReguertaThemeTokens

@Composable
internal fun HomeWeeklySummaryCard(
    display: HomeWeeklySummaryDisplay,
    modifier: Modifier = Modifier,
) {
    val spacing = ReguertaThemeTokens.spacing

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(spacing.lg),
            verticalArrangement = Arrangement.spacedBy(spacing.md),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = display.weekRangeLabel,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = display.weekBadgeLabel,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .border(
                            width = 1.dp,
                            color = MaterialTheme.colorScheme.primary,
                            shape = RoundedCornerShape(999.dp),
                        )
                        .padding(horizontal = spacing.sm, vertical = spacing.xs),
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(spacing.sm),
            ) {
                HomeSummaryField(
                    label = stringResource(R.string.home_dashboard_producer),
                    value = display.producerName,
                    modifier = Modifier.weight(1.55f),
                )
                HomeSummaryField(
                    label = stringResource(R.string.home_dashboard_delivery),
                    value = display.deliveryLabel,
                    modifier = Modifier.weight(0.95f),
                )
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(spacing.sm),
            ) {
                HomeSummaryField(
                    label = stringResource(R.string.home_dashboard_responsible),
                    value = display.responsibleName,
                    secondary = stringResource(R.string.home_dashboard_helper_format, display.helperName),
                    modifier = Modifier.weight(1.55f),
                )
                HomeOrderStatePill(
                    state = display.orderState,
                    modifier = Modifier.weight(0.95f),
                )
            }
        }
    }
}

@Composable
private fun HomeSummaryField(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    secondary: String? = null,
) {
    val spacing = ReguertaThemeTokens.spacing
    Column(
        modifier = modifier
            .heightIn(min = 66.dp)
            .clip(MaterialTheme.shapes.medium)
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, MaterialTheme.shapes.medium)
            .padding(horizontal = spacing.md, vertical = spacing.sm),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            text = value,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        secondary?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun HomeOrderStatePill(
    state: HomeOrderStateDisplay,
    modifier: Modifier = Modifier,
) {
    val spacing = ReguertaThemeTokens.spacing
    val color = state.color()
    Column(
        modifier = modifier
            .heightIn(min = 66.dp)
            .clip(MaterialTheme.shapes.medium)
            .border(1.dp, color, MaterialTheme.shapes.medium)
            .padding(horizontal = spacing.md, vertical = spacing.sm),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(
            text = stringResource(R.string.home_dashboard_state),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            text = stringResource(state.labelRes()),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            color = color,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
internal fun HomeActionRow(
    myOrderFreshnessState: MyOrderFreshnessUiState,
    canOpenReceivedOrders: Boolean,
    orderState: HomeOrderStateDisplay,
    onOpenMyOrder: () -> Unit,
    onOpenReceivedOrders: () -> Unit,
    onRetryFreshness: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val spacing = ReguertaThemeTokens.spacing
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(spacing.sm)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(spacing.sm),
        ) {
            HomeDashboardAction(
                title = stringResource(R.string.module_my_order),
                subtitle = stringResource(orderState.myOrderSubtitleRes()),
                primary = true,
                enabled = myOrderFreshnessState == MyOrderFreshnessUiState.Ready,
                onClick = onOpenMyOrder,
                modifier = Modifier.weight(1f),
            )
            if (canOpenReceivedOrders) {
                HomeDashboardAction(
                    title = stringResource(R.string.home_shell_action_received_orders),
                    subtitle = stringResource(R.string.home_dashboard_received_orders_subtitle),
                    primary = false,
                    enabled = true,
                    onClick = onOpenReceivedOrders,
                    modifier = Modifier.weight(1f),
                )
            }
        }

        when (myOrderFreshnessState) {
            MyOrderFreshnessUiState.Checking -> Text(
                text = stringResource(R.string.my_order_freshness_checking),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            MyOrderFreshnessUiState.TimedOut,
            MyOrderFreshnessUiState.Unavailable,
                -> TextButton(onClick = onRetryFreshness) {
                Text(stringResource(R.string.my_order_freshness_retry))
            }
            MyOrderFreshnessUiState.Idle,
            MyOrderFreshnessUiState.Ready,
                -> Unit
        }
    }
}

@Composable
private fun HomeDashboardAction(
    title: String,
    subtitle: String,
    primary: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val spacing = ReguertaThemeTokens.spacing
    val container = if (primary) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surface
    val content = if (primary) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.primary
    val disabledContent = MaterialTheme.colorScheme.onSurfaceVariant

    Column(
        modifier = modifier
            .heightIn(min = 82.dp)
            .clip(MaterialTheme.shapes.large)
            .background(if (enabled) container else MaterialTheme.colorScheme.surfaceVariant)
            .then(
                if (primary) {
                    Modifier
                } else {
                    Modifier.border(1.dp, MaterialTheme.colorScheme.primary, MaterialTheme.shapes.large)
                },
            )
            .clickable(enabled = enabled, onClick = onClick)
            .padding(spacing.md),
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.SemiBold,
            color = if (enabled) content else disabledContent,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            text = subtitle,
            style = MaterialTheme.typography.bodySmall,
            color = if (enabled) content.copy(alpha = 0.78f) else disabledContent,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

private fun HomeOrderStateDisplay.labelRes(): Int = when (this) {
    HomeOrderStateDisplay.NOT_STARTED -> R.string.home_dashboard_order_state_not_started
    HomeOrderStateDisplay.UNCONFIRMED -> R.string.home_dashboard_order_state_unconfirmed
    HomeOrderStateDisplay.COMPLETED -> R.string.home_dashboard_order_state_completed
}

private fun HomeOrderStateDisplay.myOrderSubtitleRes(): Int = when (this) {
    HomeOrderStateDisplay.NOT_STARTED -> R.string.home_dashboard_my_order_subtitle_edit
    HomeOrderStateDisplay.UNCONFIRMED -> R.string.home_dashboard_my_order_subtitle_review
    HomeOrderStateDisplay.COMPLETED -> R.string.home_dashboard_my_order_subtitle_completed
}

@Composable
private fun HomeOrderStateDisplay.color(): Color = when (this) {
    HomeOrderStateDisplay.NOT_STARTED -> MaterialTheme.colorScheme.error
    HomeOrderStateDisplay.UNCONFIRMED -> ColorFeedbackWarningDefault
    HomeOrderStateDisplay.COMPLETED -> MaterialTheme.colorScheme.primary
}
