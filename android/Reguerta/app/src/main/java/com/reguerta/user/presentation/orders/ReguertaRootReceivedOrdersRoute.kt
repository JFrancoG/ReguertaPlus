package com.reguerta.user.presentation.orders

import com.reguerta.user.presentation.formatting.toEuroCurrencyText
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Image
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import com.google.firebase.firestore.FirebaseFirestore
import com.reguerta.user.R
import com.reguerta.user.data.orders.FirestoreOrdersRepository
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.canAccessReceivedOrders
import com.reguerta.user.domain.calendar.DeliveryCalendarOverride
import com.reguerta.user.domain.calendar.DeliveryWeekday
import com.reguerta.user.domain.orders.ReceivedOrderProducerStatus
import com.reguerta.user.domain.orders.ReceivedOrderStatusWriteResult
import com.reguerta.user.domain.orders.ReceivedOrdersMemberGroup
import com.reguerta.user.domain.orders.ReceivedOrdersMemberLine
import com.reguerta.user.domain.orders.ReceivedOrdersProductRow
import com.reguerta.user.domain.orders.ReceivedOrdersSnapshot
import com.reguerta.user.domain.shifts.ShiftAssignment
import java.util.Locale

@Composable
internal fun ReceivedOrdersRoute(
    modifier: Modifier = Modifier,
    currentMember: Member?,
    shifts: List<ShiftAssignment>,
    defaultDeliveryDayOfWeek: DeliveryWeekday?,
    deliveryCalendarOverrides: List<DeliveryCalendarOverride>,
    nowOverrideMillis: Long?,
) {
    val firestore = remember { FirebaseFirestore.getInstance() }
    val repository = remember(firestore) { FirestoreOrdersRepository(firestore = firestore) }
    val viewModel: ReceivedOrdersViewModel = viewModel(
        factory = ReceivedOrdersViewModelFactory(repository),
    )
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val effectiveNowMillis = remember(nowOverrideMillis) { nowOverrideMillis ?: System.currentTimeMillis() }

    LaunchedEffect(
        currentMember?.id,
        currentMember?.canAccessReceivedOrders,
        shifts,
        defaultDeliveryDayOfWeek,
        deliveryCalendarOverrides,
        effectiveNowMillis,
    ) {
        viewModel.appear(
            ReceivedOrdersContext(
                producerId = currentMember?.id,
                isProducer = currentMember?.canAccessReceivedOrders == true,
                shifts = shifts,
                defaultDeliveryDayOfWeek = defaultDeliveryDayOfWeek,
                deliveryCalendarOverrides = deliveryCalendarOverrides,
                nowMillis = effectiveNowMillis,
            ),
        )
    }

    ReceivedOrdersContent(
        state = state,
        onSelectTab = viewModel::selectTab,
        onRetry = viewModel::retry,
        onSelectStatus = viewModel::updateProducerStatus,
        modifier = modifier,
    )
}

@Composable
private fun ReceivedOrdersContent(
    state: ReceivedOrdersUiState,
    onSelectTab: (ReceivedOrdersRouteTab) -> Unit,
    onRetry: () -> Unit,
    onSelectStatus: (String, ReceivedOrderProducerStatus) -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(modifier = modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = stringResource(R.string.received_orders_title),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
            )

            ReceivedOrdersRouteTabSelector(
                selectedTab = state.selectedTab,
                onSelect = onSelectTab,
            )

            state.statusWriteFeedback?.let { feedback ->
                val messageRes = when (feedback) {
                    ReceivedOrderStatusWriteResult.PERMISSION_DENIED -> R.string.received_orders_status_update_permission_denied
                    ReceivedOrderStatusWriteResult.FAILURE -> R.string.received_orders_status_update_failed
                    ReceivedOrderStatusWriteResult.SUCCESS -> null
                }
                if (messageRes != null) {
                    Text(
                        text = stringResource(messageRes),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.error,
                    )
                }
            }

            when (val loadState = state.loadState) {
                ReceivedOrdersLoadState.Idle -> {
                    if (!state.isProducer) {
                        ReceivedOrdersInfoCard(
                            title = stringResource(R.string.received_orders_producer_only_title),
                            body = stringResource(R.string.received_orders_producer_only_body),
                        )
                    } else {
                        ReceivedOrdersInfoCard(
                            title = stringResource(R.string.received_orders_window_closed_title),
                            body = stringResource(R.string.received_orders_window_closed_body),
                        )
                    }
                }

                ReceivedOrdersLoadState.Loading -> ReceivedOrdersLoadingIndicator(
                    modifier = Modifier.weight(1f),
                )

                ReceivedOrdersLoadState.Empty -> ReceivedOrdersInfoCard(
                    title = stringResource(R.string.received_orders_empty_title),
                    body = stringResource(R.string.received_orders_empty_body_format, state.window.targetWeekKey),
                )

                ReceivedOrdersLoadState.Error -> ReceivedOrdersErrorCard(onRetry = onRetry)

                is ReceivedOrdersLoadState.Loaded -> ReceivedOrdersSummaryList(
                    snapshot = loadState.snapshot,
                    selectedTab = state.selectedTab,
                    updatingStatusOrderId = state.updatingStatusOrderId,
                    onSelectStatus = onSelectStatus,
                    modifier = Modifier.weight(1f),
                )
            }
        }

        val loadedSnapshot = (state.loadState as? ReceivedOrdersLoadState.Loaded)?.snapshot
        if (loadedSnapshot != null && state.selectedTab == ReceivedOrdersRouteTab.BY_MEMBER) {
            ReceivedOrdersTotalBar(
                total = loadedSnapshot.generalTotal,
                modifier = Modifier.align(Alignment.BottomCenter),
            )
        }
    }
}

@Composable
private fun ReceivedOrdersRouteTabSelector(
    selectedTab: ReceivedOrdersRouteTab,
    onSelect: (ReceivedOrdersRouteTab) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(999.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.78f))
            .padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        ReceivedOrdersRouteTabButton(
            label = stringResource(R.string.received_orders_tab_by_product),
            selected = selectedTab == ReceivedOrdersRouteTab.BY_PRODUCT,
            onClick = { onSelect(ReceivedOrdersRouteTab.BY_PRODUCT) },
            modifier = Modifier.weight(1f),
        )
        ReceivedOrdersRouteTabButton(
            label = stringResource(R.string.received_orders_tab_by_member),
            selected = selectedTab == ReceivedOrdersRouteTab.BY_MEMBER,
            onClick = { onSelect(ReceivedOrdersRouteTab.BY_MEMBER) },
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun ReceivedOrdersRouteTabButton(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    TextButton(
        modifier = modifier
            .clip(RoundedCornerShape(999.dp))
            .background(if (selected) MaterialTheme.colorScheme.surface else Color.Transparent),
        onClick = onClick,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun ReceivedOrdersLoadingIndicator(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.fillMaxWidth(),
        contentAlignment = Alignment.Center,
    ) {
        CircularProgressIndicator(modifier = Modifier.size(28.dp), strokeWidth = 2.4.dp)
    }
}

@Composable
private fun ReceivedOrdersErrorCard(onRetry: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = stringResource(R.string.received_orders_error_title),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.error,
            )
            Text(
                text = stringResource(R.string.received_orders_error_body),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Button(onClick = onRetry) {
                Text(stringResource(R.string.received_orders_retry))
            }
        }
    }
}

@Composable
private fun ReceivedOrdersSummaryList(
    snapshot: ReceivedOrdersSnapshot,
    selectedTab: ReceivedOrdersRouteTab,
    updatingStatusOrderId: String?,
    onSelectStatus: (String, ReceivedOrderProducerStatus) -> Unit,
    modifier: Modifier = Modifier,
) {
    LazyColumn(
        modifier = modifier.fillMaxWidth(),
        contentPadding = PaddingValues(bottom = 120.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (selectedTab == ReceivedOrdersRouteTab.BY_PRODUCT) {
            items(
                items = snapshot.byProductRows,
                key = ReceivedOrdersProductRow::productId,
            ) { row ->
                ReceivedOrdersProductCard(row = row)
            }
        } else {
            items(
                items = snapshot.byMemberGroups,
                key = ReceivedOrdersMemberGroup::id,
            ) { group ->
                ReceivedOrdersMemberCard(
                    group = group,
                    isUpdatingStatus = updatingStatusOrderId == group.orderId,
                    onSelectStatus = { status -> onSelectStatus(group.orderId, status) },
                )
            }
        }
    }
}

@Composable
private fun ReceivedOrdersProductCard(row: ReceivedOrdersProductRow) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (!row.productImageUrl.isNullOrBlank()) {
                AsyncImage(
                    model = row.productImageUrl,
                    contentDescription = row.productName,
                    modifier = Modifier
                        .size(64.dp)
                        .clip(RoundedCornerShape(12.dp)),
                    contentScale = ContentScale.Crop,
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Filled.Image,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(
                    text = row.productName,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.primary,
                )
                Text(
                    text = row.packagingLine,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = row.totalQuantity.toReceivedOrdersDecimal(),
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    text = row.quantityUnitLabel(),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun ReceivedOrdersMemberCard(
    group: ReceivedOrdersMemberGroup,
    isUpdatingStatus: Boolean,
    onSelectStatus: (ReceivedOrderProducerStatus) -> Unit,
) {
    val palette = group.producerStatus.receivedOrdersStatusPalette()
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = palette.containerColor),
        border = BorderStroke(width = 1.dp, color = palette.borderColor),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = group.consumerDisplayName,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center,
            )

            ReceivedOrdersPreparedAction(
                selectedStatus = group.producerStatus,
                isUpdatingStatus = isUpdatingStatus,
                onUpdateStatus = onSelectStatus,
            )

            group.lines.forEachIndexed { index, line ->
                ReceivedOrdersMemberLineRow(line = line)
                if (index < group.lines.lastIndex) {
                    Spacer(modifier = Modifier.height(2.dp))
                }
            }

            Text(
                text = stringResource(R.string.received_orders_member_total_format, group.total.toEuroCurrencyText()),
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.error,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.End,
            )
        }
    }
}

@Composable
private fun ReceivedOrdersPreparedAction(
    selectedStatus: ReceivedOrderProducerStatus,
    isUpdatingStatus: Boolean,
    onUpdateStatus: (ReceivedOrderProducerStatus) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = stringResource(R.string.received_orders_status_title),
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            text = selectedStatus.receivedOrdersStatusLabel(),
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface,
        )

        val targetStatus = selectedStatus.nextOperationalStatus()
        if (targetStatus != null) {
            TextButton(
                modifier = Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .border(
                        width = 1.dp,
                        color = MaterialTheme.colorScheme.primary,
                        shape = RoundedCornerShape(10.dp),
                    )
                    .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.14f)),
                onClick = { onUpdateStatus(targetStatus) },
                enabled = !isUpdatingStatus,
            ) {
                Text(
                    text = stringResource(
                        if (selectedStatus == ReceivedOrderProducerStatus.PREPARED) {
                            R.string.received_orders_mark_pending
                        } else {
                            R.string.received_orders_mark_prepared
                        },
                    ),
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
        if (isUpdatingStatus) {
            Text(
                text = stringResource(R.string.received_orders_status_updating),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun ReceivedOrdersMemberLineRow(line: ReceivedOrdersMemberLine) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(
                text = line.productName,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = line.packagingLine,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(
                text = line.quantity.toReceivedOrdersDecimal(),
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = line.quantityUnitLabel(),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = line.subtotal.toEuroCurrencyText(),
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

@Composable
private fun ReceivedOrdersInfoCard(
    title: String,
    body: String,
) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = body,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun ReceivedOrdersTotalBar(
    total: Double,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .navigationBarsPadding()
            .padding(bottom = 12.dp),
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.7f),
    ) {
        Text(
            text = stringResource(R.string.received_orders_general_total_format, total.toEuroCurrencyText()),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
        )
    }
}

private data class ReceivedOrdersStatusPalette(
    val containerColor: Color,
    val borderColor: Color,
)

@Composable
private fun ReceivedOrderProducerStatus.receivedOrdersStatusLabel(): String =
    when (this) {
        ReceivedOrderProducerStatus.UNREAD -> stringResource(R.string.received_orders_status_pending)
        ReceivedOrderProducerStatus.READ -> stringResource(R.string.received_orders_status_pending)
        ReceivedOrderProducerStatus.PREPARED -> stringResource(R.string.received_orders_status_prepared)
        ReceivedOrderProducerStatus.DELIVERED -> stringResource(R.string.received_orders_status_delivered)
    }

@Composable
private fun ReceivedOrderProducerStatus.receivedOrdersStatusPalette(): ReceivedOrdersStatusPalette {
    val colors = MaterialTheme.colorScheme
    return when (this) {
        ReceivedOrderProducerStatus.UNREAD -> ReceivedOrdersStatusPalette(
            containerColor = colors.surfaceVariant.copy(alpha = 0.38f),
            borderColor = colors.outline.copy(alpha = 0.34f),
        )

        ReceivedOrderProducerStatus.READ -> ReceivedOrdersStatusPalette(
            containerColor = colors.surfaceVariant.copy(alpha = 0.38f),
            borderColor = colors.outline.copy(alpha = 0.34f),
        )

        ReceivedOrderProducerStatus.PREPARED -> ReceivedOrdersStatusPalette(
            containerColor = Color(0xFFFFF2D7),
            borderColor = Color(0xFFDCA74E),
        )

        ReceivedOrderProducerStatus.DELIVERED -> ReceivedOrdersStatusPalette(
            containerColor = Color(0xFFE6F6E7),
            borderColor = Color(0xFF74A56F),
        )
    }
}

private fun ReceivedOrderProducerStatus.nextOperationalStatus(): ReceivedOrderProducerStatus? =
    when (this) {
        ReceivedOrderProducerStatus.UNREAD,
        ReceivedOrderProducerStatus.READ,
            -> ReceivedOrderProducerStatus.PREPARED

        ReceivedOrderProducerStatus.PREPARED -> ReceivedOrderProducerStatus.READ
        ReceivedOrderProducerStatus.DELIVERED -> null
    }

private fun Double.toReceivedOrdersDecimal(): String {
    if (this % 1.0 == 0.0) {
        return toLong().toString()
    }
    return String.format(Locale.US, "%.2f", this)
        .trimEnd('0')
        .trimEnd('.')
}
