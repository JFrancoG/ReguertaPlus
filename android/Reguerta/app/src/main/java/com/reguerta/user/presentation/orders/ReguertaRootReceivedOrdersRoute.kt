package com.reguerta.user.presentation.orders

import com.reguerta.user.presentation.formatting.toEuroCurrencyText
import androidx.compose.foundation.Image
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
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
import com.reguerta.user.ui.theme.ReguertaTheme
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
                        ReceivedOrdersWindowClosedCard()
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
private fun ReceivedOrdersWindowClosedCard() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.42f),
        ),
        border = BorderStroke(
            width = 1.dp,
            color = MaterialTheme.colorScheme.primary.copy(alpha = 0.28f),
        ),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalAlignment = Alignment.Top,
        ) {
            Surface(
                modifier = Modifier.size(44.dp),
                shape = RoundedCornerShape(14.dp),
                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.14f),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Filled.Info,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                    )
                }
            }

            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    text = stringResource(R.string.received_orders_window_closed_title),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
                Text(
                    text = stringResource(R.string.received_orders_window_closed_body),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.82f),
                )
            }
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
    val navigationBarBottomPadding = WindowInsets.navigationBars
        .asPaddingValues()
        .calculateBottomPadding()
    val listBottomPadding = if (selectedTab == ReceivedOrdersRouteTab.BY_MEMBER) 120.dp else 24.dp

    LazyColumn(
        modifier = modifier.fillMaxWidth(),
        contentPadding = PaddingValues(
            bottom = navigationBarBottomPadding + listBottomPadding,
        ),
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
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.15f),
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(0.dp),
        ) {
            Box(
                modifier = Modifier.width(76.dp),
                contentAlignment = Alignment.Center,
            ) {
                val unavailableProductPainter = painterResource(R.drawable.product_no_available)
                if (!row.productImageUrl.isNullOrBlank()) {
                    AsyncImage(
                        model = row.productImageUrl,
                        contentDescription = row.productName,
                        modifier = Modifier
                            .size(64.dp)
                            .clip(RoundedCornerShape(12.dp)),
                        contentScale = ContentScale.Crop,
                        error = unavailableProductPainter,
                        fallback = unavailableProductPainter,
                    )
                } else {
                    Image(
                        painter = unavailableProductPainter,
                        contentDescription = null,
                        modifier = Modifier
                            .size(64.dp)
                            .clip(RoundedCornerShape(12.dp)),
                        contentScale = ContentScale.Crop,
                    )
                }
            }

            ReceivedOrdersVerticalDivider(height = 72.dp)

            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 8.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = row.productName,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.primary,
                    textAlign = TextAlign.Center,
                )
                Text(
                    text = row.packagingLine,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )
            }

            ReceivedOrdersVerticalDivider(height = 72.dp)

            Column(
                modifier = Modifier.width(88.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(
                    text = row.totalQuantity.toReceivedOrdersDecimal(),
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    textAlign = TextAlign.Center,
                )
                Text(
                    text = row.quantityUnitLabel(),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
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
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.15f),
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = group.consumerDisplayName,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.weight(1f),
                )

                ReceivedOrdersStatusButton(
                    selectedStatus = group.producerStatus,
                    isUpdatingStatus = isUpdatingStatus,
                    onUpdateStatus = onSelectStatus,
                )
            }

            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.8f))

            group.lines.forEachIndexed { index, line ->
                ReceivedOrdersMemberLineRow(line = line)
                HorizontalDivider(
                    color = MaterialTheme.colorScheme.outline.copy(
                        alpha = if (index < group.lines.lastIndex) 0.55f else 0.8f,
                    ),
                )
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
private fun ReceivedOrdersStatusButton(
    selectedStatus: ReceivedOrderProducerStatus,
    isUpdatingStatus: Boolean,
    onUpdateStatus: (ReceivedOrderProducerStatus) -> Unit,
) {
    val palette = selectedStatus.receivedOrdersStatusPalette()
    val targetStatus = selectedStatus.nextOperationalStatus()
    val shape = RoundedCornerShape(10.dp)

    TextButton(
        modifier = Modifier
            .clip(shape)
            .border(width = 1.dp, color = palette.borderColor, shape = shape)
            .background(palette.containerColor),
        onClick = {
            if (targetStatus != null) {
                onUpdateStatus(targetStatus)
            }
        },
        enabled = targetStatus != null && !isUpdatingStatus,
        colors = ButtonDefaults.textButtonColors(
            contentColor = palette.contentColor,
            disabledContentColor = palette.contentColor,
        ),
        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
    ) {
        Text(
            text = if (isUpdatingStatus) {
                stringResource(R.string.received_orders_status_updating)
            } else {
                selectedStatus.receivedOrdersStatusLabel()
            },
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun ReceivedOrdersVerticalDivider(height: Dp) {
    Box(
        modifier = Modifier
            .size(width = 1.dp, height = height)
            .background(MaterialTheme.colorScheme.outline.copy(alpha = 0.55f)),
    )
}

@Composable
private fun ReceivedOrdersMemberLineRow(line: ReceivedOrdersMemberLine) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(
                text = line.productName,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                text = line.packagingLine,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        ReceivedOrdersVerticalDivider(height = 50.dp)

        Column(
            modifier = Modifier.width(112.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(3.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = line.quantity.toReceivedOrdersDecimal(),
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    text = "(${line.quantityUnitLabel()})",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                text = line.subtotal.toEuroCurrencyText(),
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
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
    val contentColor: Color,
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
            containerColor = colors.surfaceVariant.copy(alpha = 0.82f),
            borderColor = colors.outline,
            contentColor = colors.onSurfaceVariant,
        )

        ReceivedOrderProducerStatus.READ -> ReceivedOrdersStatusPalette(
            containerColor = colors.surfaceVariant.copy(alpha = 0.82f),
            borderColor = colors.outline,
            contentColor = colors.onSurfaceVariant,
        )

        ReceivedOrderProducerStatus.PREPARED -> ReceivedOrdersStatusPalette(
            containerColor = colors.tertiary.copy(alpha = 0.16f),
            borderColor = colors.tertiary.copy(alpha = 0.65f),
            contentColor = colors.onSurface,
        )

        ReceivedOrderProducerStatus.DELIVERED -> ReceivedOrdersStatusPalette(
            containerColor = colors.primary.copy(alpha = 0.28f),
            borderColor = colors.primary.copy(alpha = 0.65f),
            contentColor = colors.onSurface,
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

@Preview(name = "Received orders by product - dark", widthDp = 390, heightDp = 420)
@Composable
private fun ReceivedOrdersProductCardsDarkPreview() {
    ReguertaTheme(darkTheme = true) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            ReceivedOrdersProductCard(
                row = ReceivedOrdersProductRow(
                    productId = "bread",
                    productName = "100% integral trigo",
                    productImageUrl = null,
                    packagingLine = "Pieza 750 gramos",
                    totalQuantity = 2.0,
                    quantityUnitSingular = "Pieza",
                    quantityUnitPlural = "Piezas",
                ),
            )
            ReceivedOrdersProductCard(
                row = ReceivedOrdersProductRow(
                    productId = "bagels",
                    productName = "Bagels",
                    productImageUrl = null,
                    packagingLine = "Paquete 6 unidades",
                    totalQuantity = 1.0,
                    quantityUnitSingular = "Paquete",
                    quantityUnitPlural = "Paquetes",
                ),
            )
        }
    }
}

@Preview(name = "Received orders by member - dark", widthDp = 390, heightDp = 520)
@Composable
private fun ReceivedOrdersMemberCardsDarkPreview() {
    ReguertaTheme(darkTheme = true) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            ReceivedOrdersMemberCard(
                group = ReceivedOrdersMemberGroup(
                    id = "member",
                    orderId = "order",
                    consumerDisplayName = "Ana Plazuelo",
                    producerStatus = ReceivedOrderProducerStatus.DELIVERED,
                    lines = listOf(
                        ReceivedOrdersMemberLine(
                            id = "line-1",
                            productName = "100% espelta",
                            packagingLine = "Pieza 750 gramos",
                            quantity = 1.0,
                            quantityUnitSingular = "Pieza",
                            quantityUnitPlural = "Piezas",
                            subtotal = 6.0,
                        ),
                        ReceivedOrdersMemberLine(
                            id = "line-2",
                            productName = "Semintegral con semillas",
                            packagingLine = "Pieza 750 gramos aprox.",
                            quantity = 1.0,
                            quantityUnitSingular = "Pieza",
                            quantityUnitPlural = "Piezas",
                            subtotal = 4.6,
                        ),
                    ),
                    total = 10.6,
                ),
                isUpdatingStatus = false,
                onSelectStatus = {},
            )
        }
    }
}
