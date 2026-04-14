package com.reguerta.user.presentation.access

import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.google.android.gms.tasks.Tasks
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FieldPath
import com.reguerta.user.R
import com.reguerta.user.data.firestore.ReguertaFirestoreCollection
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.firestore.ReguertaFirestorePath
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.calendar.DeliveryCalendarOverride
import com.reguerta.user.domain.calendar.DeliveryWeekday
import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.domain.shifts.ShiftType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.WeekFields
import java.util.Date
import java.util.Locale
import kotlin.math.abs
import kotlinx.coroutines.launch

private enum class ReceivedOrdersTab {
    BY_PRODUCT,
    BY_MEMBER,
}

private enum class ReceivedOrderProducerStatus(val wireValue: String) {
    UNREAD("unread"),
    READ("read"),
    PREPARED("prepared"),
    DELIVERED("delivered"),
    ;

    companion object {
        fun fromWireValue(rawValue: String?): ReceivedOrderProducerStatus {
            val normalized = rawValue?.trim()?.lowercase(Locale.ROOT)
            return entries.firstOrNull { status -> status.wireValue == normalized } ?: UNREAD
        }
    }
}

private sealed interface ReceivedOrdersUiState {
    data object Idle : ReceivedOrdersUiState
    data object Loading : ReceivedOrdersUiState
    data class Loaded(val snapshot: ReceivedOrdersSnapshot) : ReceivedOrdersUiState
    data object Empty : ReceivedOrdersUiState
    data object Error : ReceivedOrdersUiState
}

private data class ReceivedOrdersWindow(
    val isEnabled: Boolean,
    val targetWeekKey: String,
)

private data class ReceivedOrderLinePayload(
    val orderId: String,
    val consumerId: String,
    val consumerDisplayName: String,
    val productId: String,
    val productName: String,
    val productImageUrl: String?,
    val companyName: String,
    val packagingLine: String,
    val quantity: Double,
    val quantityUnitSingular: String,
    val quantityUnitPlural: String,
    val subtotal: Double,
) {
    val dedupKey: String
        get() = "$orderId|$consumerId|$productId"
}

private data class ReceivedOrdersProductRow(
    val productId: String,
    val productName: String,
    val productImageUrl: String?,
    val packagingLine: String,
    val totalQuantity: Double,
    val quantityUnitSingular: String,
    val quantityUnitPlural: String,
) {
    fun quantityUnitLabel(): String =
        if (isApproximatelyOne(totalQuantity)) quantityUnitSingular else quantityUnitPlural
}

private data class ReceivedOrdersMemberLine(
    val id: String,
    val productName: String,
    val packagingLine: String,
    val quantity: Double,
    val quantityUnitSingular: String,
    val quantityUnitPlural: String,
    val subtotal: Double,
) {
    fun quantityUnitLabel(): String =
        if (isApproximatelyOne(quantity)) quantityUnitSingular else quantityUnitPlural
}

private data class ReceivedOrdersMemberGroup(
    val id: String,
    val orderId: String,
    val consumerDisplayName: String,
    val producerStatus: ReceivedOrderProducerStatus,
    val lines: List<ReceivedOrdersMemberLine>,
    val total: Double,
)

private data class ReceivedOrdersSnapshot(
    val byProductRows: List<ReceivedOrdersProductRow>,
    val byMemberGroups: List<ReceivedOrdersMemberGroup>,
    val generalTotal: Double,
)

private data class ReceivedOrdersStatusPalette(
    val containerColor: Color,
    val borderColor: Color,
)

@Composable
internal fun ReceivedOrdersRoute(
    modifier: Modifier = Modifier,
    currentMember: Member?,
    shifts: List<ShiftAssignment>,
    defaultDeliveryDayOfWeek: DeliveryWeekday?,
    deliveryCalendarOverrides: List<DeliveryCalendarOverride>,
    nowOverrideMillis: Long?,
) {
    val isProducer = currentMember?.roles?.contains(MemberRole.PRODUCER) == true
    val effectiveNowMillis = remember(nowOverrideMillis) { nowOverrideMillis ?: System.currentTimeMillis() }
    val window = remember(defaultDeliveryDayOfWeek, deliveryCalendarOverrides, shifts, effectiveNowMillis) {
        resolveReceivedOrdersWindow(
            nowMillis = effectiveNowMillis,
            defaultDeliveryDayOfWeek = defaultDeliveryDayOfWeek,
            deliveryCalendarOverrides = deliveryCalendarOverrides,
            shifts = shifts,
        )
    }

    var selectedTab by rememberSaveable { mutableStateOf(ReceivedOrdersTab.BY_PRODUCT) }
    var uiState by remember { mutableStateOf<ReceivedOrdersUiState>(ReceivedOrdersUiState.Idle) }
    var retryToken by rememberSaveable { mutableStateOf(0) }
    var updatingStatusOrderId by rememberSaveable { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(isProducer, window.isEnabled, window.targetWeekKey, currentMember?.id, retryToken) {
        if (!isProducer || !window.isEnabled) {
            uiState = ReceivedOrdersUiState.Idle
            return@LaunchedEffect
        }
        val producerId = currentMember.id
        uiState = ReceivedOrdersUiState.Loading
        uiState = runCatching {
            val lines = loadReceivedOrderLinesForProducer(
                producerId = producerId,
                targetWeekKey = window.targetWeekKey,
            )
            if (lines.isEmpty()) {
                ReceivedOrdersUiState.Empty
            } else {
                var statusesByOrderId = loadReceivedOrderStatusesByOrderId(
                    orderIds = lines.map(ReceivedOrderLinePayload::orderId).distinct(),
                    producerId = producerId,
                )
                val unreadOrderIds = statusesByOrderId
                    .filterValues { status -> status == ReceivedOrderProducerStatus.UNREAD }
                    .keys
                    .toList()
                if (unreadOrderIds.isNotEmpty()) {
                    val markedAsRead = markReceivedOrdersAsRead(
                        orderIds = unreadOrderIds,
                        producerId = producerId,
                    )
                    if (markedAsRead.isNotEmpty()) {
                        statusesByOrderId = statusesByOrderId.toMutableMap().apply {
                            markedAsRead.forEach { orderId ->
                                this[orderId] = ReceivedOrderProducerStatus.READ
                            }
                        }
                    }
                }
                ReceivedOrdersUiState.Loaded(buildReceivedOrdersSnapshot(lines, statusesByOrderId))
            }
        }.getOrElse {
            ReceivedOrdersUiState.Error
        }
    }

    val loadedSnapshot = (uiState as? ReceivedOrdersUiState.Loaded)?.snapshot

    Box(modifier = modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = stringResource(R.string.received_orders_title),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
            )

            ReceivedOrdersTabSelector(
                selectedTab = selectedTab,
                onSelect = { selectedTab = it },
            )

            when {
                !isProducer -> {
                    InfoCard(
                        title = stringResource(R.string.received_orders_producer_only_title),
                        body = stringResource(R.string.received_orders_producer_only_body),
                    )
                }

                !window.isEnabled -> {
                    InfoCard(
                        title = stringResource(R.string.received_orders_window_closed_title),
                        body = stringResource(R.string.received_orders_window_closed_body),
                    )
                }

                uiState is ReceivedOrdersUiState.Loading || uiState is ReceivedOrdersUiState.Idle -> {
                    InfoCard(
                        title = stringResource(R.string.received_orders_loading_title),
                        body = stringResource(R.string.received_orders_loading_body),
                    )
                }

                uiState is ReceivedOrdersUiState.Empty -> {
                    InfoCard(
                        title = stringResource(R.string.received_orders_empty_title),
                        body = stringResource(
                            R.string.received_orders_empty_body_format,
                            window.targetWeekKey,
                        ),
                    )
                }

                uiState is ReceivedOrdersUiState.Error -> {
                    Card {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp),
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
                            )
                            Button(onClick = { retryToken += 1 }) {
                                Text(stringResource(R.string.received_orders_retry))
                            }
                        }
                    }
                }

                loadedSnapshot != null -> {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f),
                    ) {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(bottom = 92.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            if (selectedTab == ReceivedOrdersTab.BY_PRODUCT) {
                                items(
                                    items = loadedSnapshot.byProductRows,
                                    key = ReceivedOrdersProductRow::productId,
                                ) { row ->
                                    ReceivedOrdersProductCard(row = row)
                                }
                            } else {
                                items(
                                    items = loadedSnapshot.byMemberGroups,
                                    key = ReceivedOrdersMemberGroup::id,
                                ) { group ->
                                    ReceivedOrdersMemberCard(
                                        group = group,
                                        isUpdatingStatus = updatingStatusOrderId == group.orderId,
                                        onSelectStatus = { selectedStatus ->
                                            if (updatingStatusOrderId != null || group.producerStatus == selectedStatus) {
                                                return@ReceivedOrdersMemberCard
                                            }
                                            val producerId = currentMember.id
                                            if (producerId.isBlank()) return@ReceivedOrdersMemberCard
                                            scope.launch {
                                                updatingStatusOrderId = group.orderId
                                                val updateApplied = runCatching {
                                                    updateReceivedOrderProducerStatus(
                                                        orderId = group.orderId,
                                                        producerId = producerId,
                                                        status = selectedStatus,
                                                    )
                                                }.getOrDefault(false)
                                                if (updateApplied) {
                                                    val currentSnapshot = (uiState as? ReceivedOrdersUiState.Loaded)?.snapshot
                                                    if (currentSnapshot != null) {
                                                        uiState = ReceivedOrdersUiState.Loaded(
                                                            currentSnapshot.withProducerStatus(
                                                                orderId = group.orderId,
                                                                status = selectedStatus,
                                                            ),
                                                        )
                                                    }
                                                }
                                                updatingStatusOrderId = null
                                            }
                                        },
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        if (loadedSnapshot != null && isProducer && window.isEnabled) {
            Surface(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth(),
                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.30f),
                shape = RoundedCornerShape(12.dp),
            ) {
                Text(
                    text = stringResource(
                        R.string.received_orders_general_total_format,
                        loadedSnapshot.generalTotal.toReceivedMoney(),
                    ),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 14.dp),
                )
            }
        }
    }
}

@Composable
private fun ReceivedOrdersTabSelector(
    selectedTab: ReceivedOrdersTab,
    onSelect: (ReceivedOrdersTab) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(999.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.78f))
            .padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        ReceivedOrdersTabButton(
            label = stringResource(R.string.received_orders_tab_by_product),
            selected = selectedTab == ReceivedOrdersTab.BY_PRODUCT,
            onClick = { onSelect(ReceivedOrdersTab.BY_PRODUCT) },
            modifier = Modifier.weight(1f),
        )
        ReceivedOrdersTabButton(
            label = stringResource(R.string.received_orders_tab_by_member),
            selected = selectedTab == ReceivedOrdersTab.BY_MEMBER,
            onClick = { onSelect(ReceivedOrdersTab.BY_MEMBER) },
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun ReceivedOrdersTabButton(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    TextButton(
        modifier = modifier
            .clip(RoundedCornerShape(999.dp))
            .background(
                if (selected) {
                    MaterialTheme.colorScheme.surface
                } else {
                    MaterialTheme.colorScheme.surface.copy(alpha = 0f)
                },
            ),
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
                    text = row.totalQuantity.toReceivedUiDecimal(),
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
    val palette = group.producerStatus.statusPalette()
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
                            text = line.quantity.toReceivedUiDecimal(),
                            style = MaterialTheme.typography.bodyLarge,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            text = line.quantityUnitLabel(),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            text = "${line.subtotal.toReceivedMoney()} €",
                            style = MaterialTheme.typography.bodyLarge,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
                if (index < group.lines.lastIndex) {
                    Spacer(modifier = Modifier.height(2.dp))
                }
            }

            Text(
                text = stringResource(R.string.received_orders_member_total_format, group.total.toReceivedMoney()),
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
            text = selectedStatus.statusLabel(),
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface,
        )

        if (selectedStatus != ReceivedOrderProducerStatus.DELIVERED) {
            val isPrepared = selectedStatus == ReceivedOrderProducerStatus.PREPARED
            val targetStatus = if (isPrepared) {
                ReceivedOrderProducerStatus.READ
            } else {
                ReceivedOrderProducerStatus.PREPARED
            }
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
                        if (isPrepared) {
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
private fun InfoCard(
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

private fun resolveReceivedOrdersWindow(
    nowMillis: Long,
    defaultDeliveryDayOfWeek: DeliveryWeekday?,
    deliveryCalendarOverrides: List<DeliveryCalendarOverride>,
    shifts: List<ShiftAssignment>,
): ReceivedOrdersWindow {
    val zoneId = ZoneId.of("Europe/Madrid")
    val today = Instant.ofEpochMilli(nowMillis).atZone(zoneId).toLocalDate()
    val currentWeekKey = today.toReceivedIsoWeekKey()
    val weekStart = currentWeekKey.toIsoWeekStartDate() ?: today.with(DayOfWeek.MONDAY)
    val effectiveDeliveryDate = resolveReceivedOrdersDeliveryDate(
        currentWeekKey = currentWeekKey,
        defaultDeliveryDayOfWeek = defaultDeliveryDayOfWeek,
        deliveryCalendarOverrides = deliveryCalendarOverrides,
        shifts = shifts,
        fallbackWeekStart = weekStart,
        zoneId = zoneId,
    )
    val isConsultaPhase = !today.isBefore(weekStart) && !today.isAfter(effectiveDeliveryDate)
    return ReceivedOrdersWindow(
        isEnabled = isConsultaPhase,
        targetWeekKey = if (isConsultaPhase) weekStart.minusWeeks(1).toReceivedIsoWeekKey() else currentWeekKey,
    )
}

private fun resolveReceivedOrdersDeliveryDate(
    currentWeekKey: String,
    defaultDeliveryDayOfWeek: DeliveryWeekday?,
    deliveryCalendarOverrides: List<DeliveryCalendarOverride>,
    shifts: List<ShiftAssignment>,
    fallbackWeekStart: LocalDate,
    zoneId: ZoneId,
): LocalDate {
    val override = deliveryCalendarOverrides.firstOrNull { it.weekKey == currentWeekKey }
    if (override != null) {
        return Instant.ofEpochMilli(override.deliveryDateMillis).atZone(zoneId).toLocalDate()
    }
    val weekStart = currentWeekKey.toIsoWeekStartDate() ?: fallbackWeekStart
    val weekEnd = weekStart.plusDays(6)
    val shiftDeliveryDate = shifts
        .asSequence()
        .filter { shift -> shift.type == ShiftType.DELIVERY }
        .map { shift -> Instant.ofEpochMilli(shift.dateMillis).atZone(zoneId).toLocalDate() }
        .filter { shiftDate -> !shiftDate.isBefore(weekStart) && !shiftDate.isAfter(weekEnd) }
        .sorted()
        .firstOrNull()
    if (shiftDeliveryDate != null) {
        return shiftDeliveryDate
    }
    val deliveryDay = defaultDeliveryDayOfWeek?.toDayOfWeek() ?: DayOfWeek.WEDNESDAY
    return weekStart.plusDays((deliveryDay.value - DayOfWeek.MONDAY.value).toLong())
}

private suspend fun loadReceivedOrderLinesForProducer(
    producerId: String,
    targetWeekKey: String,
    firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
    environment: ReguertaFirestoreEnvironment = ReguertaFirestoreEnvironment.DEVELOP,
): List<ReceivedOrderLinePayload> = withContext(Dispatchers.IO) {
    val path = ReguertaFirestorePath(environment = environment)
    val readTargets = listOf(
        path.collectionPath(ReguertaFirestoreCollection.ORDER_LINES),
        "${environment.wireValue}/collections/orderLines",
        "${environment.wireValue}/collections/orderlines",
    ).distinct()

    val dedupedByKey = linkedMapOf<String, ReceivedOrderLinePayload>()
    var hasSuccessfulRead = false
    var lastFailure: Throwable? = null

    readTargets.forEach { orderLinesPath ->
        runCatching {
            Tasks.await(
                firestore.collection(orderLinesPath)
                    .whereEqualTo("vendorId", producerId)
                    .whereEqualTo("weekKey", targetWeekKey)
                    .get(),
            )
        }.onSuccess { snapshot ->
            hasSuccessfulRead = true
            snapshot.documents.forEach { document ->
                val payload = document.data.orEmpty()
                toReceivedOrderLinePayload(payload, fallbackDocumentId = document.id)?.let { line ->
                    dedupedByKey[line.dedupKey] = line
                }
            }
        }.onFailure { failure ->
            lastFailure = failure
        }
    }

    if (!hasSuccessfulRead && lastFailure != null) {
        throw lastFailure
    }

    dedupedByKey.values.sortedWith(
        compareBy(
            { it.consumerDisplayName.lowercase(Locale.ROOT) },
            { it.productName.lowercase(Locale.ROOT) },
        ),
    )
}

private suspend fun loadReceivedOrderStatusesByOrderId(
    orderIds: List<String>,
    producerId: String,
    firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
    environment: ReguertaFirestoreEnvironment = ReguertaFirestoreEnvironment.DEVELOP,
): Map<String, ReceivedOrderProducerStatus> = withContext(Dispatchers.IO) {
    if (orderIds.isEmpty()) return@withContext emptyMap()

    val path = ReguertaFirestorePath(environment = environment)
    val readTargets = listOf(
        path.collectionPath(ReguertaFirestoreCollection.ORDERS),
        "${environment.wireValue}/collections/orders",
    ).distinct()
    val statusesByOrderId = mutableMapOf<String, ReceivedOrderProducerStatus>()
    var hasSuccessfulRead = false
    var lastFailure: Throwable? = null

    readTargets.forEach { ordersPath ->
        orderIds.distinct().chunked(10).forEach { chunk ->
            runCatching {
                Tasks.await(
                    firestore.collection(ordersPath)
                        .whereIn(FieldPath.documentId(), chunk)
                        .get(),
                )
            }.onSuccess { snapshot ->
                hasSuccessfulRead = true
                snapshot.documents.forEach { document ->
                    val payload = document.data.orEmpty()
                    statusesByOrderId[document.id] = payload.readProducerStatusForVendor(producerId)
                }
            }.onFailure { failure ->
                lastFailure = failure
            }
        }
    }

    if (!hasSuccessfulRead && lastFailure != null) {
        throw lastFailure
    }
    statusesByOrderId
}

private suspend fun updateReceivedOrderProducerStatus(
    orderId: String,
    producerId: String,
    status: ReceivedOrderProducerStatus,
    firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
    environment: ReguertaFirestoreEnvironment = ReguertaFirestoreEnvironment.DEVELOP,
    nowMillis: Long = System.currentTimeMillis(),
): Boolean = withContext(Dispatchers.IO) {
    val path = ReguertaFirestorePath(environment = environment)
    val writeTargets = listOf(
        path.collectionPath(ReguertaFirestoreCollection.ORDERS),
        "${environment.wireValue}/collections/orders",
    ).distinct()
    val nowTimestamp = Timestamp(Date(nowMillis))

    writeTargets.any { ordersPath ->
        runCatching {
            val orderReference = firestore.document("$ordersPath/$orderId")
            Tasks.await(
                orderReference.update(
                    mapOf(
                        "producerStatus" to status.wireValue,
                        "producerStatusesByVendor.$producerId" to status.wireValue,
                        "updatedAt" to nowTimestamp,
                    ),
                ),
            )
            true
        }.getOrDefault(false)
    }
}

private suspend fun markReceivedOrdersAsRead(
    orderIds: List<String>,
    producerId: String,
): Set<String> {
    val updatedOrderIds = linkedSetOf<String>()
    orderIds.distinct().forEach { orderId ->
        val updated = updateReceivedOrderProducerStatus(
            orderId = orderId,
            producerId = producerId,
            status = ReceivedOrderProducerStatus.READ,
        )
        if (updated) {
            updatedOrderIds += orderId
        }
    }
    return updatedOrderIds
}

private fun buildReceivedOrdersSnapshot(
    lines: List<ReceivedOrderLinePayload>,
    statusesByOrderId: Map<String, ReceivedOrderProducerStatus>,
): ReceivedOrdersSnapshot {
    val byProductRows = lines.groupBy { it.productId }
        .mapNotNull { (productId, grouped) ->
            val first = grouped.firstOrNull() ?: return@mapNotNull null
            ReceivedOrdersProductRow(
                productId = productId,
                productName = first.productName,
                productImageUrl = first.productImageUrl,
                packagingLine = first.packagingLine,
                totalQuantity = grouped.sumOf { line -> line.quantity },
                quantityUnitSingular = first.quantityUnitSingular,
                quantityUnitPlural = first.quantityUnitPlural,
            )
        }
        .sortedBy { it.productName.lowercase(Locale.ROOT) }

    val byMemberGroups = lines.groupBy { line ->
        "${line.consumerId}|${line.consumerDisplayName}"
    }.mapNotNull { (key, grouped) ->
        val first = grouped.firstOrNull() ?: return@mapNotNull null
        val memberLines = grouped.map { line ->
            ReceivedOrdersMemberLine(
                id = "${line.orderId}|${line.productId}",
                productName = line.productName,
                packagingLine = line.packagingLine,
                quantity = line.quantity,
                quantityUnitSingular = line.quantityUnitSingular,
                quantityUnitPlural = line.quantityUnitPlural,
                subtotal = line.subtotal,
            )
        }.sortedBy { it.productName.lowercase(Locale.ROOT) }
        ReceivedOrdersMemberGroup(
            id = key,
            orderId = first.orderId,
            consumerDisplayName = first.consumerDisplayName,
            producerStatus = statusesByOrderId[first.orderId] ?: ReceivedOrderProducerStatus.UNREAD,
            lines = memberLines,
            total = memberLines.sumOf { it.subtotal },
        )
    }.sortedBy { it.consumerDisplayName.lowercase(Locale.ROOT) }

    return ReceivedOrdersSnapshot(
        byProductRows = byProductRows,
        byMemberGroups = byMemberGroups,
        generalTotal = lines.sumOf { it.subtotal },
    )
}

private fun Map<String, Any>.readProducerStatusForVendor(producerId: String): ReceivedOrderProducerStatus {
    val statusesByVendor = this["producerStatusesByVendor"] as? Map<*, *>
    val vendorValue = statusesByVendor?.get(producerId) as? String
    if (!vendorValue.isNullOrBlank()) {
        return ReceivedOrderProducerStatus.fromWireValue(vendorValue)
    }
    return ReceivedOrderProducerStatus.fromWireValue(this["producerStatus"] as? String)
}

private fun toReceivedOrderLinePayload(
    payload: Map<String, Any>,
    fallbackDocumentId: String,
): ReceivedOrderLinePayload? {
    val orderId = (payload["orderId"] as? String)?.trim().orEmpty().ifBlank { fallbackDocumentId }
    val consumerId = (payload["userId"] as? String)?.trim().orEmpty().ifBlank { "__consumer_unknown__" }
    val consumerDisplayName = (payload["consumerDisplayName"] as? String)?.trim().orEmpty()
        .ifBlank { consumerId }
    val productId = (payload["productId"] as? String)?.trim().orEmpty().ifBlank { fallbackDocumentId }
    val productName = (payload["productName"] as? String)?.trim().orEmpty().ifBlank { "Producto" }
    val companyName = (payload["companyName"] as? String)?.trim().orEmpty().ifBlank { "Productor" }
    val quantity = (payload["quantity"] as? Number)?.toDouble() ?: 0.0
    if (quantity <= 0.0) {
        return null
    }
    val subtotal = (payload["subtotal"] as? Number)?.toDouble()
        ?: quantity * ((payload["priceAtOrder"] as? Number)?.toDouble() ?: 0.0)
    val quantityUnitSingular = (payload["packContainerName"] as? String)?.trim().orEmpty()
        .ifBlank { (payload["unitName"] as? String)?.trim().orEmpty().ifBlank { "ud." } }
    val quantityUnitPlural = (payload["packContainerPlural"] as? String)?.trim().orEmpty()
        .ifBlank { (payload["unitPlural"] as? String)?.trim().orEmpty().ifBlank { quantityUnitSingular } }

    return ReceivedOrderLinePayload(
        orderId = orderId,
        consumerId = consumerId,
        consumerDisplayName = consumerDisplayName,
        productId = productId,
        productName = productName,
        productImageUrl = (payload["productImageUrl"] as? String)?.trim().orEmpty().ifBlank { null },
        companyName = companyName,
        packagingLine = receivedOrdersPackagingLineFromPayload(payload),
        quantity = quantity,
        quantityUnitSingular = quantityUnitSingular,
        quantityUnitPlural = quantityUnitPlural,
        subtotal = subtotal,
    )
}

private fun receivedOrdersPackagingLineFromPayload(payload: Map<String, Any>): String {
    val containerName = (payload["packContainerName"] as? String)
        ?.takeIf(String::isNotBlank)
        ?: (payload["unitName"] as? String).orEmpty()
    val quantity = ((payload["packContainerQty"] as? Number)?.toDouble()
        ?: (payload["unitQty"] as? Number)?.toDouble()
        ?: 1.0).toReceivedUiDecimal()
    val fallbackUnitName = (payload["unitName"] as? String).orEmpty()
    val fallbackUnitPlural = (payload["unitPlural"] as? String).orEmpty()
    val unitLabel = (payload["packContainerAbbreviation"] as? String)
        ?.takeIf(String::isNotBlank)
        ?: (payload["packContainerPlural"] as? String)?.takeIf(String::isNotBlank)
        ?: (payload["unitAbbreviation"] as? String)?.takeIf(String::isNotBlank)
        ?: if (((payload["packContainerQty"] as? Number)?.toDouble() ?: 1.0) == 1.0) {
            fallbackUnitName
        } else {
            fallbackUnitPlural
        }

    return listOf(containerName, quantity, unitLabel)
        .filter { value -> value.isNotBlank() }
        .joinToString(separator = " ")
}

private fun ReceivedOrdersSnapshot.withProducerStatus(
    orderId: String,
    status: ReceivedOrderProducerStatus,
): ReceivedOrdersSnapshot {
    val updatedGroups = byMemberGroups.map { group ->
        if (group.orderId == orderId) {
            group.copy(producerStatus = status)
        } else {
            group
        }
    }
    return copy(byMemberGroups = updatedGroups)
}

@Composable
private fun ReceivedOrderProducerStatus.statusLabel(): String =
    when (this) {
        ReceivedOrderProducerStatus.UNREAD -> stringResource(R.string.received_orders_status_pending)
        ReceivedOrderProducerStatus.READ -> stringResource(R.string.received_orders_status_pending)
        ReceivedOrderProducerStatus.PREPARED -> stringResource(R.string.received_orders_status_prepared)
        ReceivedOrderProducerStatus.DELIVERED -> stringResource(R.string.received_orders_status_delivered)
    }

@Composable
private fun ReceivedOrderProducerStatus.statusPalette(): ReceivedOrdersStatusPalette {
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

private fun LocalDate.toReceivedIsoWeekKey(): String {
    val week = get(WeekFields.ISO.weekOfWeekBasedYear())
    val year = get(WeekFields.ISO.weekBasedYear())
    return String.format(Locale.US, "%04d-W%02d", year, week)
}

private fun Double.toReceivedUiDecimal(): String {
    if (this % 1.0 == 0.0) {
        return toLong().toString()
    }
    return String.format(Locale.US, "%.2f", this)
        .trimEnd('0')
        .trimEnd('.')
}

private fun Double.toReceivedMoney(): String =
    String.format(Locale.US, "%.2f", this)

private fun isApproximatelyOne(value: Double): Boolean =
    abs(value - 1.0) < 0.0001
