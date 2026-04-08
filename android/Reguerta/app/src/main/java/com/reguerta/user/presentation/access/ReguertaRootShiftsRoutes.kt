package com.reguerta.user.presentation.access

import androidx.annotation.StringRes
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
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

@Composable
fun ShiftsRoute(
    shifts: List<ShiftAssignment>,
    shiftSwapRequests: List<ShiftSwapRequest>,
    dismissedShiftSwapRequestIds: Set<String>,
    nextDeliveryShift: ShiftAssignment?,
    nextMarketShift: ShiftAssignment?,
    deliveryCalendarOverrides: List<DeliveryCalendarOverride>,
    currentMember: Member?,
    members: List<Member>,
    isLoading: Boolean,
    isUpdatingShiftSwapRequest: Boolean,
    onRefresh: () -> Unit,
    onRequestShiftSwap: (String) -> Unit,
    onAcceptShiftSwapRequest: (String, String) -> Unit,
    onRejectShiftSwapRequest: (String, String) -> Unit,
    onCancelShiftSwapRequest: (String) -> Unit,
    onConfirmShiftSwapRequest: (String, String) -> Unit,
    onDismissShiftSwapActivity: (String) -> Unit,
) {
    var selectedSegment by rememberSaveable { mutableStateOf(ShiftBoardSegment.DELIVERY) }
    val deliveryShifts = remember(shifts) {
        shifts.filter { it.type == ShiftType.DELIVERY }.sortedBy { it.dateMillis }
    }
    val marketShifts = remember(shifts) {
        shifts.filter { it.type == ShiftType.MARKET }.sortedBy { it.dateMillis }
    }

    Column(
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Card {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    text = stringResource(R.string.shifts_title),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = stringResource(R.string.shifts_list_subtitle),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Button(onClick = onRefresh) {
                    Text(text = stringResource(R.string.shifts_refresh_action))
                }
            }
        }

        NextShiftsCard(
            nextDeliveryShift = nextDeliveryShift,
            nextMarketShift = nextMarketShift,
            deliveryCalendarOverrides = deliveryCalendarOverrides,
            isLoading = isLoading,
            members = members,
            onViewAll = onRefresh,
        )

        ShiftSwapRequestsCard(
            requests = shiftSwapRequests,
            dismissedRequestIds = dismissedShiftSwapRequestIds,
            shifts = shifts,
            deliveryCalendarOverrides = deliveryCalendarOverrides,
            members = members,
            currentMemberId = currentMember?.id,
            selectedSegment = selectedSegment,
            isUpdating = isUpdatingShiftSwapRequest,
            onAccept = onAcceptShiftSwapRequest,
            onReject = onRejectShiftSwapRequest,
            onCancel = onCancelShiftSwapRequest,
            onConfirm = onConfirmShiftSwapRequest,
            onDismissRequest = onDismissShiftSwapActivity,
        )

        if (isLoading) {
            Card {
                Text(
                    text = stringResource(R.string.shifts_loading),
                    modifier = Modifier.padding(16.dp),
                )
            }
        } else if (shifts.isEmpty()) {
            Card {
                Text(
                    text = stringResource(R.string.shifts_empty_state),
                    modifier = Modifier.padding(16.dp),
                )
            }
        } else {
            ShiftBoardSegmentSelector(
                selectedSegment = selectedSegment,
                onSegmentSelected = { selectedSegment = it },
            )

            val boardShifts = when (selectedSegment) {
                ShiftBoardSegment.DELIVERY -> deliveryShifts
                ShiftBoardSegment.MARKET -> marketShifts
            }

            if (boardShifts.isEmpty()) {
                Card {
                    Text(
                        text = stringResource(R.string.shifts_empty_state),
                        modifier = Modifier.padding(16.dp),
                    )
                }
            } else {
                boardShifts.forEach { shift ->
                    ShiftBoardCard(
                        shift = shift,
                        deliveryCalendarOverrides = deliveryCalendarOverrides,
                        members = members,
                        currentMemberId = currentMember?.id,
                        onRequestShiftSwap = onRequestShiftSwap,
                    )
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
            TextButton(
                onClick = { onSegmentSelected(segment) },
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(20.dp))
                    .background(
                        if (isSelected) {
                            MaterialTheme.colorScheme.primary.copy(alpha = 0.16f)
                        } else {
                            MaterialTheme.colorScheme.surface.copy(alpha = 0f)
                        }
                    ),
            ) {
                Text(
                    text = stringResource(segment.labelRes),
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
    deliveryCalendarOverrides: List<DeliveryCalendarOverride>,
    members: List<Member>,
    currentMemberId: String?,
    onRequestShiftSwap: (String) -> Unit,
) {
    val primaryNames = shift.primaryBoardNames(members)
    val leftLines = shift.leftBoardLines(deliveryCalendarOverrides)
    val leftAlignment = if (shift.type == ShiftType.MARKET) Alignment.CenterHorizontally else Alignment.Start
    val canRequestShiftSwap = remember(shift, currentMemberId, deliveryCalendarOverrides) {
        currentMemberId != null && shift.canBeRequestedBy(currentMemberId, deliveryCalendarOverrides)
    }
    val highlightedIndex = remember(shift, currentMemberId) {
        currentMemberId?.let { shift.highlightedBoardNameIndex(it) }
    }
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Column(
                    modifier = Modifier.weight(0.38f),
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
                    modifier = Modifier.weight(0.62f),
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
                ReguertaButton(
                    label = stringResource(R.string.shift_swap_request_button_label),
                    variant = ReguertaButtonVariant.SECONDARY,
                    fullWidth = false,
                    onClick = { onRequestShiftSwap(shift.id) },
                )
            }
        }
    }
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
