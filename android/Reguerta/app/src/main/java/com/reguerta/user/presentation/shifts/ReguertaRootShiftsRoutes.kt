package com.reguerta.user.presentation.shifts

import com.reguerta.user.presentation.root.ShiftSwapDraft

import androidx.annotation.StringRes
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.reguerta.user.R
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.calendar.DeliveryCalendarOverride
import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.domain.shifts.ShiftStatus
import com.reguerta.user.domain.shifts.ShiftSwapRequest
import com.reguerta.user.domain.shifts.ShiftType
import com.reguerta.user.ui.components.auth.ReguertaButton
import com.reguerta.user.ui.components.auth.ReguertaButtonVariant
import com.reguerta.user.ui.components.auth.ReguertaCard

@Composable
fun ShiftsRoute(
    shifts: List<ShiftAssignment>,
    shiftSwapRequests: List<ShiftSwapRequest>,
    dismissedShiftSwapRequestIds: Set<String>,
    deliveryCalendarOverrides: List<DeliveryCalendarOverride>,
    currentMember: Member?,
    members: List<Member>,
    isLoading: Boolean,
    isUpdatingShiftSwapRequest: Boolean,
    nowMillis: Long,
    onRequestShiftSwap: (String) -> Unit,
    onAcceptShiftSwapRequest: (String, String) -> Unit,
    onRejectShiftSwapRequest: (String, String) -> Unit,
    onCancelShiftSwapRequest: (String) -> Unit,
    onConfirmShiftSwapRequest: (String, String) -> Unit,
    onDismissShiftSwapActivity: (String) -> Unit,
) {
    var selectedSegment by rememberSaveable { mutableStateOf(ShiftBoardSegment.DELIVERY) }
    val currentMemberId = currentMember?.id
    val deliveryShifts = remember(shifts, deliveryCalendarOverrides) {
        shifts
            .filter { it.type == ShiftType.DELIVERY }
            .sortedBy { it.effectiveDateMillis(deliveryCalendarOverrides) }
    }
    val marketShifts = remember(shifts, deliveryCalendarOverrides) {
        shifts
            .filter { it.type == ShiftType.MARKET }
            .sortedBy { it.effectiveDateMillis(deliveryCalendarOverrides) }
    }
    val hasShiftSwapActivity = remember(shiftSwapRequests, dismissedShiftSwapRequestIds, currentMemberId) {
        shiftSwapRequests.hasVisibleShiftSwapActivity(
            currentMemberId = currentMemberId,
            dismissedRequestIds = dismissedShiftSwapRequestIds,
        )
    }

    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        if (hasShiftSwapActivity) {
            ShiftSwapRequestsCard(
                requests = shiftSwapRequests,
                dismissedRequestIds = dismissedShiftSwapRequestIds,
                shifts = shifts,
                deliveryCalendarOverrides = deliveryCalendarOverrides,
                members = members,
                currentMemberId = currentMemberId,
                isUpdating = isUpdatingShiftSwapRequest,
                onAccept = onAcceptShiftSwapRequest,
                onReject = onRejectShiftSwapRequest,
                onCancel = onCancelShiftSwapRequest,
                onConfirm = onConfirmShiftSwapRequest,
                onDismissRequest = onDismissShiftSwapActivity,
            )
        }

        MyNextShiftsSection(
            shifts = shifts,
            deliveryCalendarOverrides = deliveryCalendarOverrides,
            currentMemberId = currentMemberId,
            nowMillis = nowMillis,
            isLoading = isLoading,
        )

        ShiftBoardSection(
            modifier = Modifier.weight(1f),
            selectedSegment = selectedSegment,
            onSegmentSelected = { selectedSegment = it },
            deliveryShifts = deliveryShifts,
            marketShifts = marketShifts,
            deliveryCalendarOverrides = deliveryCalendarOverrides,
            members = members,
            currentMemberId = currentMemberId,
            nowMillis = nowMillis,
            isLoading = isLoading,
            onRequestShiftSwap = onRequestShiftSwap,
        )
    }
}

@Composable
private fun MyNextShiftsSection(
    shifts: List<ShiftAssignment>,
    deliveryCalendarOverrides: List<DeliveryCalendarOverride>,
    currentMemberId: String?,
    nowMillis: Long,
    isLoading: Boolean,
) {
    val leadShift = remember(shifts, deliveryCalendarOverrides, currentMemberId, nowMillis) {
        currentMemberId?.let {
            shifts.nextDeliveryLeadShift(
                memberId = it,
                overrides = deliveryCalendarOverrides,
                nowMillis = nowMillis,
            )
        }
    }
    val helperShift = remember(shifts, deliveryCalendarOverrides, currentMemberId, nowMillis) {
        currentMemberId?.let {
            shifts.nextDeliveryHelperShift(
                memberId = it,
                overrides = deliveryCalendarOverrides,
                nowMillis = nowMillis,
            )
        }
    }
    val marketShift = remember(shifts, deliveryCalendarOverrides, currentMemberId, nowMillis) {
        currentMemberId?.let {
            shifts.nextMarketAssignedShift(
                memberId = it,
                overrides = deliveryCalendarOverrides,
                nowMillis = nowMillis,
            )
        }
    }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = stringResource(R.string.shifts_next_title),
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = FontWeight.Normal,
            textAlign = TextAlign.Center,
            modifier = Modifier
                .fillMaxWidth()
                .semantics { heading() },
        )

        if (isLoading) {
            Text(
                text = stringResource(R.string.shifts_loading),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        } else {
            ReguertaCard(
                modifier = Modifier.semantics(mergeDescendants = true) {},
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = stringResource(R.string.shifts_type_delivery),
                            style = MaterialTheme.typography.bodyLarge,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.primary,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.weight(1f),
                        )
                        Column(
                            modifier = Modifier.weight(2f),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            NextShiftDateLine(
                                label = stringResource(R.string.shifts_next_delivery_helper),
                                value = helperShift.shiftShortDateLabel(deliveryCalendarOverrides),
                                prominent = false,
                            )
                            NextShiftDateLine(
                                label = stringResource(R.string.shifts_next_delivery_lead),
                                value = leadShift.shiftShortDateLabel(deliveryCalendarOverrides),
                                prominent = true,
                            )
                        }
                    }
                    HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.45f))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = stringResource(R.string.shifts_type_market),
                            style = MaterialTheme.typography.bodyLarge,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.primary,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            text = marketShift.shiftShortDateLabel(deliveryCalendarOverrides),
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Normal,
                            color = MaterialTheme.colorScheme.onSurface,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.weight(2f),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun NextShiftDateLine(
    label: String,
    value: String,
    prominent: Boolean,
    modifier: Modifier = Modifier,
): Unit = Text(
    text = "$value $label",
    modifier = modifier.fillMaxWidth(),
    style = if (prominent) MaterialTheme.typography.bodyMedium else MaterialTheme.typography.bodySmall,
    fontWeight = FontWeight.Normal,
    color = MaterialTheme.colorScheme.onSurface,
    textAlign = TextAlign.Center,
)

@Composable
private fun ShiftAssignment?.shiftShortDateLabel(
    deliveryCalendarOverrides: List<DeliveryCalendarOverride>,
): String =
    this?.effectiveDateMillis(deliveryCalendarOverrides)?.toShortDateOnly()
        ?: stringResource(R.string.shifts_next_pending)

@Composable
private fun ShiftBoardSection(
    modifier: Modifier = Modifier,
    selectedSegment: ShiftBoardSegment,
    onSegmentSelected: (ShiftBoardSegment) -> Unit,
    deliveryShifts: List<ShiftAssignment>,
    marketShifts: List<ShiftAssignment>,
    deliveryCalendarOverrides: List<DeliveryCalendarOverride>,
    members: List<Member>,
    currentMemberId: String?,
    nowMillis: Long,
    isLoading: Boolean,
    onRequestShiftSwap: (String) -> Unit,
) {
    val boardShifts = when (selectedSegment) {
        ShiftBoardSegment.DELIVERY -> deliveryShifts
        ShiftBoardSegment.MARKET -> marketShifts
    }
    val boardWindow = remember(boardShifts, deliveryCalendarOverrides, nowMillis) {
        boardShifts.shiftBoardWindow(
            overrides = deliveryCalendarOverrides,
            nowMillis = nowMillis,
        )
    }
    val listState = rememberLazyListState()

    LaunchedEffect(selectedSegment, boardWindow.targetShiftId, boardShifts.size) {
        val targetIndex = boardShifts.indexOfFirst { shift -> shift.id == boardWindow.targetShiftId }
        if (targetIndex >= 0) {
            listState.scrollToItem(targetIndex)
        }
    }

    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        ShiftBoardSegmentSelector(
            selectedSegment = selectedSegment,
            onSegmentSelected = onSegmentSelected,
        )

        when {
            isLoading -> {
                Card {
                    Text(
                        text = stringResource(R.string.shifts_loading),
                        modifier = Modifier.padding(16.dp),
                    )
                }
            }

            boardShifts.isEmpty() -> {
                Card {
                    Text(
                        text = stringResource(R.string.shifts_empty_state),
                        modifier = Modifier.padding(16.dp),
                    )
                }
            }

            else -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    state = listState,
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    items(
                        items = boardShifts,
                        key = { shift -> shift.id },
                    ) { shift ->
                        ShiftBoardCard(
                            shift = shift,
                            deliveryShifts = deliveryShifts,
                            deliveryCalendarOverrides = deliveryCalendarOverrides,
                            members = members,
                            currentMemberId = currentMemberId,
                            containerColor = shift.boardCardContainerColor(boardWindow),
                            onRequestShiftSwap = onRequestShiftSwap,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ShiftBoardSegmentSelector(
    selectedSegment: ShiftBoardSegment,
    onSegmentSelected: (ShiftBoardSegment) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f))
            .padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        ShiftBoardSegment.entries.forEach { segment ->
            val isSelected = selectedSegment == segment
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(18.dp))
                    .semantics { selected = isSelected }
                    .background(
                        if (isSelected) {
                            MaterialTheme.colorScheme.primary.copy(alpha = 0.16f)
                        } else {
                            MaterialTheme.colorScheme.surface.copy(alpha = 0f)
                        }
                    )
                    .clickable { onSegmentSelected(segment) }
                    .padding(vertical = 7.dp, horizontal = 8.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = stringResource(segment.labelRes),
                    style = MaterialTheme.typography.bodyLarge,
                    color = if (isSelected) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    },
                    fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Medium,
                )
            }
        }
    }
}

@Composable
private fun ShiftBoardCard(
    shift: ShiftAssignment,
    deliveryShifts: List<ShiftAssignment>,
    deliveryCalendarOverrides: List<DeliveryCalendarOverride>,
    members: List<Member>,
    currentMemberId: String?,
    containerColor: Color,
    onRequestShiftSwap: (String) -> Unit,
) {
    val resolvedHelperUserId = remember(shift, deliveryShifts) {
        deliveryShifts.resolvedHelperUserIdFor(shift)
    }
    val primaryNames = shift.primaryBoardNames(members, resolvedHelperUserId)
    val leftLines = shift.leftBoardLines(deliveryCalendarOverrides)
    val leftAlignment = if (shift.type == ShiftType.MARKET) Alignment.CenterHorizontally else Alignment.Start
    val canRequestShiftSwap = remember(shift, currentMemberId, deliveryCalendarOverrides) {
        currentMemberId != null && shift.canBeRequestedBy(currentMemberId, deliveryCalendarOverrides)
    }
    val highlightedIndex = remember(shift, currentMemberId, resolvedHelperUserId) {
        currentMemberId?.let { shift.highlightedBoardNameIndex(it, resolvedHelperUserId) }
    }
    Card(
        colors = CardDefaults.cardColors(containerColor = containerColor),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(
                    modifier = Modifier.weight(0.30f),
                    horizontalAlignment = leftAlignment,
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    leftLines.forEach { line ->
                        Text(
                            text = line.text,
                            style = line.style,
                            fontWeight = line.fontWeight,
                            color = line.color ?: MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = if (shift.type == ShiftType.MARKET) TextAlign.Center else TextAlign.Start,
                        )
                    }
                }

                Column(
                    modifier = Modifier.weight(0.70f),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    primaryNames.forEachIndexed { index, name ->
                        val marketStyle = MaterialTheme.typography.bodyMedium
                        Text(
                            text = name,
                            style = if (shift.type == ShiftType.MARKET) {
                                marketStyle
                            } else if (index == 0) {
                                MaterialTheme.typography.bodyLarge
                            } else {
                                MaterialTheme.typography.bodyMedium
                            },
                            fontWeight = if (shift.type == ShiftType.MARKET) FontWeight.Normal else if (index == 0) FontWeight.SemiBold else FontWeight.Normal,
                            color = if (shift.type != ShiftType.MARKET && highlightedIndex == index) {
                                MaterialTheme.colorScheme.primary
                            } else {
                                MaterialTheme.colorScheme.onSurface
                            },
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    if (shift.status != ShiftStatus.PLANNED) {
                        Text(
                            text = stringResource(shift.status.labelRes()),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
            if (highlightedIndex != null && canRequestShiftSwap) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                ) {
                    ReguertaButton(
                        label = stringResource(R.string.shift_swap_request_button_label),
                        variant = ReguertaButtonVariant.SECONDARY,
                        modifier = Modifier.widthIn(min = 192.dp),
                        cornerRadius = 999.dp,
                        fullWidth = false,
                        onClick = { onRequestShiftSwap(shift.id) },
                    )
                }
            }
        }
    }
}

@Composable
private fun ShiftAssignment.boardCardContainerColor(window: ShiftBoardWindow): Color =
    if (window.highlights(id)) {
        MaterialTheme.colorScheme.tertiary.copy(alpha = 0.15f)
    } else {
        MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)
    }

enum class ShiftBoardSegment(@param:StringRes val labelRes: Int) {
    DELIVERY(R.string.shifts_type_delivery),
    MARKET(R.string.shifts_type_market),
}

data class ShiftBoardLine(
    val text: String,
    val style: androidx.compose.ui.text.TextStyle,
    val fontWeight: FontWeight = FontWeight.Normal,
    val color: androidx.compose.ui.graphics.Color? = null,
)

@Composable
@Suppress("UNUSED_PARAMETER")
fun ShiftSwapRequestRoute(
    draft: ShiftSwapDraft,
    shifts: List<ShiftAssignment>,
    deliveryCalendarOverrides: List<DeliveryCalendarOverride>,
    members: List<Member>,
    isSaving: Boolean,
    onDraftChanged: (ShiftSwapDraft) -> Unit,
    onCancel: () -> Unit,
    onSave: () -> Unit,
) {
    val focusManager = androidx.compose.ui.platform.LocalFocusManager.current
    val shift = shifts.firstOrNull { it.id == draft.shiftId }
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = stringResource(R.string.shift_swap_request_screen_title),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = stringResource(R.string.shift_swap_request_screen_subtitle),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = stringResource(
                    R.string.shift_swap_request_shift_format,
                    shift?.let {
                        it.toShiftSwapDisplayLabel(
                            it.assignedUserIds.firstOrNull() ?: it.helperUserId,
                            deliveryCalendarOverrides,
                        )
                    }.orEmpty().ifBlank { draft.shiftId },
                ),
                style = MaterialTheme.typography.bodyMedium,
            )
            Text(
                text = stringResource(
                    R.string.shift_swap_request_broadcast_scope_format,
                    when (shift?.type) {
                        ShiftType.MARKET -> stringResource(R.string.shifts_type_market)
                        else -> stringResource(R.string.shifts_type_delivery)
                    },
                ),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            OutlinedTextField(
                value = draft.reason,
                onValueChange = { onDraftChanged(draft.copy(reason = it)) },
                modifier = Modifier.fillMaxWidth(),
                label = { Text(stringResource(R.string.shift_swap_request_reason_label)) },
                placeholder = { Text(stringResource(R.string.shift_swap_request_reason_placeholder)) },
                minLines = 4,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ReguertaButton(
                    label = stringResource(
                        if (isSaving) {
                            R.string.shift_swap_request_saving
                        } else {
                            R.string.shift_swap_request_save
                        },
                    ),
                    variant = ReguertaButtonVariant.PRIMARY,
                    fullWidth = false,
                    loading = isSaving,
                    enabled = !isSaving && draft.shiftId.isNotBlank(),
                    onClick = {
                        focusManager.clearFocus(force = true)
                        onSave()
                    },
                )
                ReguertaButton(
                    label = stringResource(R.string.common_action_back),
                    variant = ReguertaButtonVariant.SECONDARY,
                    fullWidth = false,
                    enabled = !isSaving,
                    onClick = {
                        focusManager.clearFocus(force = true)
                        onCancel()
                    },
                )
            }
        }
    }
}
