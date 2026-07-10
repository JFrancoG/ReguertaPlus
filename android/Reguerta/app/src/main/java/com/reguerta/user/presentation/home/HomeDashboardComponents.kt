package com.reguerta.user.presentation.home

import com.reguerta.user.presentation.root.MyOrderFreshnessUiState

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.reguerta.user.R
import com.reguerta.user.ui.theme.ColorFeedbackWarningDefault
import com.reguerta.user.ui.theme.ReguertaThemeTokens

private val HomeSummaryGridRowHeight = 76.dp

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
                .padding(vertical = spacing.lg),
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
                    fontWeight = FontWeight.Normal,
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

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(MaterialTheme.shapes.medium)
                    .border(1.dp, MaterialTheme.colorScheme.outlineVariant, MaterialTheme.shapes.medium),
            ) {
                HomeSummaryGridRow(
                    modifier = Modifier.height(HomeSummaryGridRowHeight),
                    leftContent = {
                        HomeSummaryPrimaryCell(
                            label = stringResource(R.string.home_dashboard_state),
                            value = stringResource(display.orderState.labelRes()),
                            valueColor = display.orderState.color(),
                            maxValueLines = 2,
                        )
                    },
                    rightContent = {
                        HomeSummaryPrimaryCell(
                            label = stringResource(R.string.home_dashboard_producer),
                            value = display.producerName,
                        )
                    },
                )
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                HomeSummaryGridRow(
                    modifier = Modifier.height(HomeSummaryGridRowHeight),
                    leftContent = {
                        HomeSummaryPrimaryCell(
                            label = stringResource(R.string.home_dashboard_delivery),
                            value = display.deliveryLabel,
                        )
                    },
                    rightContent = {
                        HomeSummaryResponsibleCell(
                            label = stringResource(R.string.home_dashboard_delivery_responsibles),
                            primary = display.responsibleName,
                            secondary = stringResource(R.string.home_dashboard_helper_format, display.helperName),
                        )
                    },
                )
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                HomeSummaryGridRow(
                    modifier = Modifier.height(HomeSummaryGridRowHeight),
                    leftContent = {
                        HomeSummaryPrimaryCell(
                            label = stringResource(R.string.home_dashboard_market),
                            value = display.marketLabel,
                        )
                    },
                    rightContent = {
                        HomeSummaryMarketResponsiblesCell(
                            label = stringResource(R.string.home_dashboard_market_responsibles),
                            names = display.marketResponsibleNames,
                        )
                    },
                )
            }
        }
    }
}

@Composable
private fun HomeSummaryGridRow(
    modifier: Modifier = Modifier,
    leftContent: @Composable () -> Unit,
    rightContent: @Composable () -> Unit,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
    ) {
        Box(
            modifier = Modifier
                .weight(0.84f)
                .fillMaxHeight(),
            contentAlignment = Alignment.Center,
        ) {
            leftContent()
        }
        VerticalDivider(
            modifier = Modifier.fillMaxHeight(),
            color = MaterialTheme.colorScheme.outlineVariant,
        )
        Box(
            modifier = Modifier
                .weight(1.66f)
                .fillMaxHeight(),
            contentAlignment = Alignment.Center,
        ) {
            rightContent()
        }
    }
}

@Composable
private fun HomeSummaryPrimaryCell(
    label: String,
    value: String,
    valueColor: Color = MaterialTheme.colorScheme.onSurface,
    maxValueLines: Int = 1,
) {
    val spacing = ReguertaThemeTokens.spacing
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 56.dp)
            .padding(horizontal = spacing.sm, vertical = spacing.xs),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            text = value,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            color = valueColor,
            textAlign = TextAlign.Center,
            maxLines = maxValueLines,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun HomeSummaryResponsibleCell(
    label: String,
    primary: String,
    secondary: String,
) {
    val spacing = ReguertaThemeTokens.spacing
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 56.dp)
            .padding(horizontal = spacing.sm, vertical = spacing.xs),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            text = primary,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            text = secondary,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun HomeSummaryMarketResponsiblesCell(
    label: String,
    names: List<String>,
) {
    val spacing = ReguertaThemeTokens.spacing
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 56.dp)
            .padding(horizontal = spacing.sm, vertical = spacing.xs),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        names.take(3).forEach { name ->
            Text(
                text = name,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
internal fun HomeActionRow(
    myOrderFreshnessState: MyOrderFreshnessUiState,
    canOpenReceivedOrders: Boolean,
    orderState: HomeOrderStateDisplay,
    isConsultaPhase: Boolean,
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
                subtitle = stringResource(orderState.myOrderSubtitleRes(isConsultaPhase)),
                primary = true,
                enabled = myOrderFreshnessState == MyOrderFreshnessUiState.Ready,
                onClick = onOpenMyOrder,
                modifier = Modifier.weight(1f),
            )
            if (canOpenReceivedOrders) {
                HomeDashboardAction(
                    title = stringResource(R.string.home_shell_action_received_orders),
                    subtitle = null,
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
    subtitle: String?,
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
        horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.SemiBold,
            color = if (enabled) content else disabledContent,
            textAlign = TextAlign.Center,
            maxLines = if (subtitle == null) 2 else 1,
            overflow = TextOverflow.Ellipsis,
        )
        subtitle?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.bodySmall,
                color = if (enabled) content.copy(alpha = 0.78f) else disabledContent,
                textAlign = TextAlign.Center,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

private fun HomeOrderStateDisplay.labelRes(): Int = when (this) {
    HomeOrderStateDisplay.CONSULTATION -> R.string.home_dashboard_order_state_consultation
    HomeOrderStateDisplay.NOT_STARTED -> R.string.home_dashboard_order_state_not_started
    HomeOrderStateDisplay.UNCONFIRMED -> R.string.home_dashboard_order_state_unconfirmed
    HomeOrderStateDisplay.COMPLETED -> R.string.home_dashboard_order_state_completed
}

private fun HomeOrderStateDisplay.myOrderSubtitleRes(isConsultaPhase: Boolean): Int = when {
    isConsultaPhase -> R.string.home_dashboard_my_order_subtitle_last_order
    this == HomeOrderStateDisplay.CONSULTATION -> R.string.home_dashboard_my_order_subtitle_last_order
    this == HomeOrderStateDisplay.NOT_STARTED -> R.string.home_dashboard_my_order_subtitle_edit
    this == HomeOrderStateDisplay.UNCONFIRMED -> R.string.home_dashboard_my_order_subtitle_review
    else -> R.string.home_dashboard_my_order_subtitle_completed
}

@Composable
private fun HomeOrderStateDisplay.color(): Color = when (this) {
    HomeOrderStateDisplay.CONSULTATION -> MaterialTheme.colorScheme.onSurface
    HomeOrderStateDisplay.NOT_STARTED -> MaterialTheme.colorScheme.error
    HomeOrderStateDisplay.UNCONFIRMED -> ColorFeedbackWarningDefault
    HomeOrderStateDisplay.COMPLETED -> MaterialTheme.colorScheme.primary
}
