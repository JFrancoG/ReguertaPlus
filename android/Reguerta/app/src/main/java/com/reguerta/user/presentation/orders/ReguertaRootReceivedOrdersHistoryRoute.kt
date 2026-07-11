package com.reguerta.user.presentation.orders

import com.reguerta.user.presentation.formatting.toEuroCurrencyText
import android.widget.NumberPicker
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Image
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import com.google.firebase.firestore.FirebaseFirestore
import com.reguerta.user.R
import com.reguerta.user.data.orders.FirestoreOrdersRepository
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.canAccessReceivedOrders
import com.reguerta.user.domain.orders.OrderHistoryWeekOption
import com.reguerta.user.domain.orders.ReceivedOrderProducerStatus
import com.reguerta.user.domain.orders.ReceivedOrdersMemberGroup
import com.reguerta.user.domain.orders.ReceivedOrdersMemberLine
import com.reguerta.user.domain.orders.ReceivedOrdersProductRow
import com.reguerta.user.domain.orders.ReceivedOrdersSnapshot
import java.util.Locale

@Composable
internal fun ReceivedOrdersHistoryRoute(
    modifier: Modifier = Modifier,
    currentMember: Member?,
    nowOverrideMillis: Long?,
    onTitleChanged: (String?) -> Unit = {},
) {
    val firestore = remember { FirebaseFirestore.getInstance() }
    val repository = remember(firestore) { FirestoreOrdersRepository(firestore = firestore) }
    val viewModel: ReceivedOrdersHistoryViewModel = viewModel(
        factory = ReceivedOrdersHistoryViewModelFactory(repository),
    )
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val effectiveNowMillis = remember(nowOverrideMillis) { nowOverrideMillis ?: System.currentTimeMillis() }
    val locale = LocalConfiguration.current.locales[0]
    val weekCopy = MyOrdersHistoryWeekCopy(
        weekLabel = stringResource(R.string.my_orders_history_week_label),
        shortWeekLabel = stringResource(R.string.my_orders_history_week_short_label),
        orderLabel = stringResource(R.string.received_orders_history_title_label),
    )
    val selectedWeekPresentation = state.selectedWeek?.toMyOrdersHistoryPresentation(locale, weekCopy)

    LaunchedEffect(currentMember?.id, currentMember?.canAccessReceivedOrders, effectiveNowMillis) {
        viewModel.appear(
            ReceivedOrdersHistoryContext(
                producerId = currentMember?.id,
                isProducer = currentMember?.canAccessReceivedOrders == true,
                nowMillis = effectiveNowMillis,
            ),
        )
    }
    LaunchedEffect(selectedWeekPresentation?.orderTitle) {
        onTitleChanged(selectedWeekPresentation?.orderTitle)
    }
    DisposableEffect(Unit) {
        onDispose { onTitleChanged(null) }
    }

    ReceivedOrdersHistoryContent(
        state = state,
        onPrevious = viewModel::selectPreviousWeek,
        onNext = viewModel::selectNextWeek,
        onRetry = viewModel::retry,
        onSelectTab = viewModel::selectTab,
        onOpenPicker = viewModel::presentWeekPicker,
        onDismissPicker = viewModel::dismissWeekPicker,
        onPickerSelection = viewModel::setPickerSelection,
        onCommitPicker = viewModel::commitPickerSelection,
        locale = locale,
        weekCopy = weekCopy,
        modifier = modifier,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ReceivedOrdersHistoryContent(
    state: ReceivedOrdersHistoryUiState,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
    onRetry: () -> Unit,
    onSelectTab: (ReceivedOrdersHistoryTab) -> Unit,
    onOpenPicker: () -> Unit,
    onDismissPicker: () -> Unit,
    onPickerSelection: (String) -> Unit,
    onCommitPicker: () -> Unit,
    locale: Locale,
    weekCopy: MyOrdersHistoryWeekCopy,
    modifier: Modifier = Modifier,
) {
    val selectedWeekPresentation = state.selectedWeek?.toMyOrdersHistoryPresentation(locale, weekCopy)
    Box(modifier = modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            ReceivedOrdersHistoryWeekHeader(
                selectedWeek = selectedWeekPresentation,
                canGoPrevious = state.canGoPrevious,
                canGoNext = state.canGoNext,
                onPrevious = onPrevious,
                onNext = onNext,
                onOpenPicker = onOpenPicker,
            )

            ReceivedOrdersHistoryTabSelector(
                selectedTab = state.selectedTab,
                onSelect = onSelectTab,
            )

            when (val loadState = state.loadState) {
                ReceivedOrdersHistoryLoadState.Idle -> {
                    ReceivedOrdersHistoryInfoCard(
                        title = stringResource(R.string.received_orders_producer_only_title),
                        body = stringResource(R.string.received_orders_producer_only_body),
                    )
                }

                ReceivedOrdersHistoryLoadState.Loading -> ReceivedOrdersHistoryLoadingIndicator(
                    modifier = Modifier.weight(1f),
                )

                ReceivedOrdersHistoryLoadState.Empty -> ReceivedOrdersHistoryEmptyState()

                ReceivedOrdersHistoryLoadState.Error -> ReceivedOrdersHistoryErrorCard(onRetry = onRetry)

                is ReceivedOrdersHistoryLoadState.Loaded -> ReceivedOrdersHistorySummaryList(
                    snapshot = loadState.snapshot,
                    selectedTab = state.selectedTab,
                    modifier = Modifier.weight(1f),
                )
            }
        }

        val loadedSnapshot = (state.loadState as? ReceivedOrdersHistoryLoadState.Loaded)?.snapshot
        if (loadedSnapshot != null && !state.isWeekPickerVisible && state.selectedTab == ReceivedOrdersHistoryTab.BY_MEMBER) {
            ReceivedOrdersHistoryTotalBar(
                total = loadedSnapshot.generalTotal,
                modifier = Modifier.align(Alignment.BottomCenter),
            )
        }
    }

    if (state.isWeekPickerVisible) {
        ModalBottomSheet(onDismissRequest = onDismissPicker) {
            ReceivedOrdersHistoryWeekPickerSheet(
                weeks = state.availableWeeks,
                locale = locale,
                weekCopy = weekCopy,
                selectedWeekKey = state.pickerSelectedWeekKey ?: state.selectedWeekKey,
                onSelectionChange = onPickerSelection,
                onCancel = onDismissPicker,
                onDone = onCommitPicker,
            )
        }
    }
}

@Composable
private fun ReceivedOrdersHistoryWeekHeader(
    selectedWeek: MyOrdersHistoryWeekPresentation?,
    canGoPrevious: Boolean,
    canGoNext: Boolean,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
    onOpenPicker: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        ReceivedOrdersHistoryGlassNavButton(
            imageVector = Icons.Filled.ChevronLeft,
            enabled = canGoPrevious,
            contentDescription = stringResource(R.string.my_orders_history_previous_week),
            onClick = onPrevious,
        )
        ReceivedOrdersHistoryGlassPickerButton(
            title = selectedWeek?.title ?: stringResource(R.string.my_orders_history_week_fallback),
            onClick = onOpenPicker,
        )
        ReceivedOrdersHistoryGlassNavButton(
            imageVector = Icons.Filled.ChevronRight,
            enabled = canGoNext,
            contentDescription = stringResource(R.string.my_orders_history_next_week),
            onClick = onNext,
        )
    }
}

@Composable
private fun ReceivedOrdersHistoryGlassNavButton(
    imageVector: ImageVector,
    enabled: Boolean,
    contentDescription: String,
    onClick: () -> Unit,
) {
    Surface(
        shape = CircleShape,
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = if (enabled) 1f else 0.45f),
        tonalElevation = if (enabled) 8.dp else 0.dp,
        shadowElevation = if (enabled) 3.dp else 0.dp,
        border = BorderStroke(
            1.dp,
            MaterialTheme.colorScheme.outline.copy(alpha = if (enabled) 0.80f else 0.35f),
        ),
    ) {
        IconButton(
            onClick = onClick,
            enabled = enabled,
            modifier = Modifier.size(46.dp),
        ) {
            Icon(
                imageVector = imageVector,
                contentDescription = contentDescription,
                tint = if (enabled) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.48f)
                },
            )
        }
    }
}

@Composable
private fun ReceivedOrdersHistoryGlassPickerButton(
    title: String,
    onClick: () -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(50),
        color = MaterialTheme.colorScheme.surfaceVariant,
        tonalElevation = 8.dp,
        shadowElevation = 3.dp,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.80f)),
    ) {
        TextButton(onClick = onClick) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(horizontal = 10.dp),
            )
        }
    }
}

@Composable
private fun ReceivedOrdersHistoryTabSelector(
    selectedTab: ReceivedOrdersHistoryTab,
    onSelect: (ReceivedOrdersHistoryTab) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(999.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.78f))
            .padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        ReceivedOrdersHistoryTabButton(
            label = stringResource(R.string.received_orders_tab_by_product),
            selected = selectedTab == ReceivedOrdersHistoryTab.BY_PRODUCT,
            onClick = { onSelect(ReceivedOrdersHistoryTab.BY_PRODUCT) },
            modifier = Modifier.weight(1f),
        )
        ReceivedOrdersHistoryTabButton(
            label = stringResource(R.string.received_orders_tab_by_member),
            selected = selectedTab == ReceivedOrdersHistoryTab.BY_MEMBER,
            onClick = { onSelect(ReceivedOrdersHistoryTab.BY_MEMBER) },
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun ReceivedOrdersHistoryTabButton(
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
private fun ReceivedOrdersHistoryLoadingIndicator(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.fillMaxWidth(),
        contentAlignment = Alignment.Center,
    ) {
        CircularProgressIndicator(modifier = Modifier.size(28.dp), strokeWidth = 2.4.dp)
    }
}

@Composable
private fun ReceivedOrdersHistoryEmptyState() {
    Text(
        text = stringResource(R.string.received_orders_history_empty),
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.error,
        textAlign = TextAlign.Center,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 24.dp),
    )
}

@Composable
private fun ReceivedOrdersHistoryErrorCard(onRetry: () -> Unit) {
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
            TextButton(onClick = onRetry) {
                Text(text = stringResource(R.string.received_orders_retry))
            }
        }
    }
}

@Composable
private fun ReceivedOrdersHistorySummaryList(
    snapshot: ReceivedOrdersSnapshot,
    selectedTab: ReceivedOrdersHistoryTab,
    modifier: Modifier = Modifier,
) {
    LazyColumn(
        modifier = modifier.fillMaxWidth(),
        contentPadding = PaddingValues(bottom = 120.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (selectedTab == ReceivedOrdersHistoryTab.BY_PRODUCT) {
            items(
                items = snapshot.byProductRows,
                key = ReceivedOrdersProductRow::productId,
            ) { row ->
                ReceivedOrdersHistoryProductCard(row = row)
            }
        } else {
            items(
                items = snapshot.byMemberGroups,
                key = ReceivedOrdersMemberGroup::id,
            ) { group ->
                ReceivedOrdersHistoryMemberCard(group = group)
            }
        }
    }
}

@Composable
private fun ReceivedOrdersHistoryProductCard(row: ReceivedOrdersProductRow) {
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
                    text = row.totalQuantity.toReceivedOrdersHistoryDecimal(),
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
private fun ReceivedOrdersHistoryMemberCard(group: ReceivedOrdersMemberGroup) {
    val palette = group.producerStatus.historyStatusPalette()
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
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    text = group.consumerDisplayName,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.weight(1f),
                )
                ReceivedOrdersHistoryStatusText(status = group.producerStatus)
            }

            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.24f))

            group.lines.forEachIndexed { index, line ->
                ReceivedOrdersHistoryMemberLineRow(line = line)
                if (index < group.lines.lastIndex) {
                    HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.18f))
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
private fun ReceivedOrdersHistoryMemberLineRow(line: ReceivedOrdersMemberLine) {
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
                text = line.quantity.toReceivedOrdersHistoryDecimal(),
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
private fun ReceivedOrdersHistoryStatusText(status: ReceivedOrderProducerStatus) {
    Text(
        text = stringResource(R.string.common_status_format, status.historyStatusLabel()),
        style = MaterialTheme.typography.labelMedium,
        fontWeight = FontWeight.SemiBold,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.End,
    )
}

@Composable
private fun ReceivedOrdersHistoryInfoCard(
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
private fun ReceivedOrdersHistoryTotalBar(
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

@Composable
private fun ReceivedOrdersHistoryWeekPickerSheet(
    weeks: List<OrderHistoryWeekOption>,
    locale: Locale,
    weekCopy: MyOrdersHistoryWeekCopy,
    selectedWeekKey: String?,
    onSelectionChange: (String) -> Unit,
    onCancel: () -> Unit,
    onDone: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TextButton(onClick = onCancel) {
                Text(stringResource(R.string.common_action_cancel))
            }
            Spacer(modifier = Modifier.weight(1f))
            Button(onClick = onDone, enabled = weeks.isNotEmpty()) {
                Text(stringResource(R.string.my_orders_history_picker_select))
            }
        }
        if (weeks.isNotEmpty()) {
            ReceivedOrdersHistoryNumberPickerWheel(
                weeks = weeks,
                locale = locale,
                weekCopy = weekCopy,
                selectedWeekKey = selectedWeekKey,
                onSelectionChange = onSelectionChange,
            )
        }
    }
}

@Composable
private fun ReceivedOrdersHistoryNumberPickerWheel(
    weeks: List<OrderHistoryWeekOption>,
    locale: Locale,
    weekCopy: MyOrdersHistoryWeekCopy,
    selectedWeekKey: String?,
    onSelectionChange: (String) -> Unit,
) {
    val labels = remember(weeks, locale, weekCopy) {
        weeks.map { it.toMyOrdersHistoryPresentation(locale, weekCopy).pickerLabel }.toTypedArray()
    }
    val selectedIndex = weeks.indexOfFirst { it.weekKey == selectedWeekKey }.takeIf { it >= 0 } ?: 0
    AndroidView(
        modifier = Modifier
            .fillMaxWidth()
            .height(184.dp),
        factory = { context ->
            NumberPicker(context).apply {
                wrapSelectorWheel = false
                minValue = 0
                maxValue = labels.lastIndex
                displayedValues = labels
                value = selectedIndex
                setOnValueChangedListener { _, _, newValue ->
                    weeks.getOrNull(newValue)?.weekKey?.let(onSelectionChange)
                }
            }
        },
        update = { picker ->
            picker.displayedValues = null
            picker.minValue = 0
            picker.maxValue = labels.lastIndex
            picker.displayedValues = labels
            picker.value = selectedIndex.coerceIn(0, labels.lastIndex)
        },
    )
}

private data class ReceivedOrdersHistoryStatusPalette(
    val containerColor: Color,
    val borderColor: Color,
)

@Composable
private fun ReceivedOrderProducerStatus.historyStatusLabel(): String =
    when (this) {
        ReceivedOrderProducerStatus.UNREAD -> stringResource(R.string.received_orders_status_pending)
        ReceivedOrderProducerStatus.READ -> stringResource(R.string.received_orders_status_pending)
        ReceivedOrderProducerStatus.PREPARED -> stringResource(R.string.received_orders_status_prepared)
        ReceivedOrderProducerStatus.DELIVERED -> stringResource(R.string.received_orders_status_delivered)
    }

@Composable
private fun ReceivedOrderProducerStatus.historyStatusPalette(): ReceivedOrdersHistoryStatusPalette {
    val colors = MaterialTheme.colorScheme
    return when (this) {
        ReceivedOrderProducerStatus.UNREAD -> ReceivedOrdersHistoryStatusPalette(
            containerColor = colors.surfaceVariant.copy(alpha = 0.38f),
            borderColor = colors.outline.copy(alpha = 0.34f),
        )

        ReceivedOrderProducerStatus.READ -> ReceivedOrdersHistoryStatusPalette(
            containerColor = colors.surfaceVariant.copy(alpha = 0.38f),
            borderColor = colors.outline.copy(alpha = 0.34f),
        )

        ReceivedOrderProducerStatus.PREPARED -> ReceivedOrdersHistoryStatusPalette(
            containerColor = Color(0xFFFFF2D7),
            borderColor = Color(0xFFDCA74E),
        )

        ReceivedOrderProducerStatus.DELIVERED -> ReceivedOrdersHistoryStatusPalette(
            containerColor = Color(0xFFE6F6E7),
            borderColor = Color(0xFF74A56F),
        )
    }
}

private fun Double.toReceivedOrdersHistoryDecimal(): String {
    if (this % 1.0 == 0.0) {
        return toLong().toString()
    }
    return String.format(Locale.US, "%.2f", this)
        .trimEnd('0')
        .trimEnd('.')
}
