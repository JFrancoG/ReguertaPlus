package com.reguerta.user.presentation.orders

import com.reguerta.user.presentation.formatting.toEuroCurrencyText
import android.widget.NumberPicker
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.google.firebase.firestore.FirebaseFirestore
import com.reguerta.user.R
import com.reguerta.user.data.orders.FirestoreOrdersRepository
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.orders.OrderHistoryWeekOption
import com.reguerta.user.domain.orders.OrderSummaryGroup
import com.reguerta.user.domain.orders.OrderSummarySnapshot
import com.reguerta.user.ui.components.ReguertaScreenTitle

@Composable
internal fun MyOrdersHistoryRoute(
    modifier: Modifier = Modifier,
    currentMember: Member?,
    nowOverrideMillis: Long?,
) {
    val firestore = remember { FirebaseFirestore.getInstance() }
    val repository = remember(firestore) { FirestoreOrdersRepository(firestore = firestore) }
    val viewModel: MyOrdersHistoryViewModel = viewModel(
        factory = MyOrdersHistoryViewModelFactory(repository),
    )
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val effectiveNowMillis = remember(nowOverrideMillis) { nowOverrideMillis ?: System.currentTimeMillis() }

    LaunchedEffect(currentMember?.id, effectiveNowMillis) {
        viewModel.appear(
            MyOrdersHistoryContext(
                currentMemberId = currentMember?.id,
                nowMillis = effectiveNowMillis,
            ),
        )
    }
    MyOrdersHistoryContent(
        state = state,
        onPrevious = viewModel::selectPreviousWeek,
        onNext = viewModel::selectNextWeek,
        onRetry = viewModel::retry,
        onOpenPicker = viewModel::presentWeekPicker,
        onDismissPicker = viewModel::dismissWeekPicker,
        onPickerSelection = viewModel::setPickerSelection,
        onCommitPicker = viewModel::commitPickerSelection,
        modifier = modifier,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MyOrdersHistoryContent(
    state: MyOrdersHistoryUiState,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
    onRetry: () -> Unit,
    onOpenPicker: () -> Unit,
    onDismissPicker: () -> Unit,
    onPickerSelection: (String) -> Unit,
    onCommitPicker: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier.fillMaxSize(),
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            state.selectedWeek?.orderTitle?.let { orderTitle ->
                ReguertaScreenTitle(title = orderTitle)
            }
            OrderHistoryWeekHeader(
                selectedWeek = state.selectedWeek,
                canGoPrevious = state.canGoPrevious,
                canGoNext = state.canGoNext,
                onPrevious = onPrevious,
                onNext = onNext,
                onOpenPicker = onOpenPicker,
            )

            when (val loadState = state.loadState) {
                MyOrdersHistoryLoadState.Idle,
                MyOrdersHistoryLoadState.Loading -> OrderHistoryLoadingIndicator(
                    modifier = Modifier.weight(1f),
                )

                MyOrdersHistoryLoadState.Empty -> OrderHistoryEmptyState()

                MyOrdersHistoryLoadState.Error -> OrderHistoryErrorCard(onRetry = onRetry)

                is MyOrdersHistoryLoadState.Loaded -> OrderSummaryList(
                    snapshot = loadState.snapshot,
                    modifier = Modifier.weight(1f),
                )
            }
        }

        val loadedSnapshot = (state.loadState as? MyOrdersHistoryLoadState.Loaded)?.snapshot
        if (loadedSnapshot != null && !state.isWeekPickerVisible) {
            OrderSummaryTotalBar(
                snapshot = loadedSnapshot,
                modifier = Modifier.align(Alignment.BottomCenter),
            )
        }
    }

    if (state.isWeekPickerVisible) {
        ModalBottomSheet(onDismissRequest = onDismissPicker) {
            OrderHistoryWeekPickerSheet(
                weeks = state.availableWeeks,
                selectedWeekKey = state.pickerSelectedWeekKey ?: state.selectedWeekKey,
                onSelectionChange = onPickerSelection,
                onCancel = onDismissPicker,
                onDone = onCommitPicker,
            )
        }
    }
}

@Composable
private fun OrderHistoryWeekHeader(
    selectedWeek: OrderHistoryWeekOption?,
    canGoPrevious: Boolean,
    canGoNext: Boolean,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
    onOpenPicker: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            GlassWeekNavigationButton(
                imageVector = Icons.Filled.ChevronLeft,
                enabled = canGoPrevious,
                contentDescription = stringResource(R.string.my_orders_history_previous_week),
                onClick = onPrevious,
            )
            GlassWeekPickerButton(
                title = selectedWeek?.title ?: stringResource(R.string.my_orders_history_week_fallback),
                onClick = onOpenPicker,
            )
            GlassWeekNavigationButton(
                imageVector = Icons.Filled.ChevronRight,
                enabled = canGoNext,
                contentDescription = stringResource(R.string.my_orders_history_next_week),
                onClick = onNext,
            )
        }
    }
}

@Composable
private fun GlassWeekNavigationButton(
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
private fun GlassWeekPickerButton(
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
private fun OrderHistoryLoadingIndicator(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.fillMaxWidth(),
        contentAlignment = Alignment.Center,
    ) {
        CircularProgressIndicator(modifier = Modifier.size(28.dp), strokeWidth = 2.4.dp)
    }
}

@Composable
private fun OrderHistoryEmptyState() {
    Text(
        text = stringResource(R.string.my_orders_history_empty),
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.error,
        textAlign = TextAlign.Center,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 24.dp),
    )
}

@Composable
private fun OrderHistoryErrorCard(onRetry: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = stringResource(R.string.my_orders_history_error),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            TextButton(onClick = onRetry) {
                Text(text = stringResource(R.string.my_order_previous_retry))
            }
        }
    }
}

@Composable
private fun OrderSummaryList(
    snapshot: OrderSummarySnapshot,
    modifier: Modifier = Modifier,
) {
    LazyColumn(
        modifier = modifier.fillMaxWidth(),
        contentPadding = PaddingValues(bottom = 120.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        items(
            items = snapshot.groups,
            key = OrderSummaryGroup::vendorId,
        ) { group ->
            OrderSummaryProducerCard(group = group)
        }
    }
}

@Composable
private fun OrderSummaryProducerCard(group: OrderSummaryGroup) {
    PersonalOrderSummaryProducerCard(
        companyName = group.companyName,
        lines = group.lines.map { line ->
            PersonalOrderSummaryLineUi(
                productName = line.productName,
                packagingLine = line.packagingLine,
                quantityLabel = line.quantityLabel,
                subtotal = line.subtotal,
            )
        },
        subtotal = group.subtotal,
    )
}

@Composable
private fun OrderSummaryTotalBar(
    snapshot: OrderSummarySnapshot,
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
            text = stringResource(
                R.string.my_order_confirmed_total_sum_format,
                snapshot.total.toEuroCurrencyText(),
            ),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
        )
    }
}

@Composable
private fun OrderHistoryWeekPickerSheet(
    weeks: List<OrderHistoryWeekOption>,
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
            NumberPickerWheel(
                weeks = weeks,
                selectedWeekKey = selectedWeekKey,
                onSelectionChange = onSelectionChange,
            )
        }
    }
}

@Composable
private fun NumberPickerWheel(
    weeks: List<OrderHistoryWeekOption>,
    selectedWeekKey: String?,
    onSelectionChange: (String) -> Unit,
) {
    val labels = remember(weeks) { weeks.map(OrderHistoryWeekOption::pickerLabel).toTypedArray() }
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
