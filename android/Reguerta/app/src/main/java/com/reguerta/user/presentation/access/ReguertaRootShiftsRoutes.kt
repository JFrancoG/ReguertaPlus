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
import com.reguerta.user.domain.calendar.DeliveryWeekday
import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.domain.shifts.ShiftStatus
import com.reguerta.user.domain.shifts.ShiftSwapRequest
import com.reguerta.user.domain.shifts.ShiftSwapRequestStatus
import com.reguerta.user.domain.shifts.ShiftType
import com.reguerta.user.ui.components.auth.ReguertaButton
import com.reguerta.user.ui.components.auth.ReguertaButtonVariant
import com.reguerta.user.ui.components.auth.ReguertaFlatButton

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
private fun ShiftSwapRequestsCard(
    requests: List<ShiftSwapRequest>,
    dismissedRequestIds: Set<String>,
    shifts: List<ShiftAssignment>,
    deliveryCalendarOverrides: List<DeliveryCalendarOverride>,
    members: List<Member>,
    currentMemberId: String?,
    selectedSegment: ShiftBoardSegment,
    isUpdating: Boolean,
    onAccept: (String, String) -> Unit,
    onReject: (String, String) -> Unit,
    onCancel: (String) -> Unit,
    onConfirm: (String, String) -> Unit,
    onDismissRequest: (String) -> Unit,
) {
    val relevantRequests = remember(requests, shifts, selectedSegment) {
        requests.filter { request ->
            shifts.firstOrNull { it.id == request.requestedShiftId }?.type == selectedSegment.toShiftType()
        }
    }

    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = stringResource(R.string.shift_swap_requests_title),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = stringResource(R.string.shift_swap_requests_subtitle),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            if (relevantRequests.isEmpty() || currentMemberId == null) {
                Text(
                    text = stringResource(R.string.shift_swap_requests_empty),
                    style = MaterialTheme.typography.bodyMedium,
                )
                return@Column
            }

            val incoming = relevantRequests.flatMap { request ->
                request.candidates
                    .filter { it.userId == currentMemberId }
                    .filter { candidate ->
                        request.status == ShiftSwapRequestStatus.OPEN &&
                            request.responses.none { response ->
                                response.userId == candidate.userId && response.shiftId == candidate.shiftId
                            }
                    }
                    .map { candidate -> request to candidate }
            }
            val requesterOpen = relevantRequests.filter { it.requesterUserId == currentMemberId && it.status == ShiftSwapRequestStatus.OPEN }
            val availableResponses = requesterOpen.flatMap { request ->
                request.availableResponses().mapNotNull { response ->
                    val candidate = request.candidates.firstOrNull { it.userId == response.userId && it.shiftId == response.shiftId }
                    candidate?.let { Triple(request, it, response) }
                }
            }
            val waiting = requesterOpen.filter { request -> request.availableResponses().isEmpty() }
            val history = relevantRequests.filter { request ->
                request.status != ShiftSwapRequestStatus.OPEN &&
                    request.id !in dismissedRequestIds
            }

            if (incoming.isNotEmpty()) {
                IncomingShiftSwapSection(
                    title = stringResource(R.string.shift_swap_requests_incoming),
                    pendingCandidates = incoming,
                    shifts = shifts,
                    deliveryCalendarOverrides = deliveryCalendarOverrides,
                    members = members,
                    isUpdating = isUpdating,
                    onAccept = onAccept,
                    onReject = onReject,
                )
            }

            if (availableResponses.isNotEmpty()) {
                RequesterResponsesSection(
                    title = stringResource(R.string.shift_swap_requests_responses),
                    responseOptions = availableResponses,
                    shifts = shifts,
                    deliveryCalendarOverrides = deliveryCalendarOverrides,
                    members = members,
                    isUpdating = isUpdating,
                    onConfirm = onConfirm,
                )
            }

            if (waiting.isNotEmpty()) {
                WaitingShiftSwapSection(
                    title = stringResource(R.string.shift_swap_requests_outgoing),
                    requests = waiting,
                    shifts = shifts,
                    deliveryCalendarOverrides = deliveryCalendarOverrides,
                    members = members,
                    onCancel = onCancel,
                )
            }

            if (history.isNotEmpty()) {
                HistoryShiftSwapSection(
                    title = stringResource(R.string.shift_swap_requests_history),
                    requests = history,
                    shifts = shifts,
                    deliveryCalendarOverrides = deliveryCalendarOverrides,
                    members = members,
                    onDismissRequest = onDismissRequest,
                )
            }
        }
    }
}

@Composable
private fun IncomingShiftSwapSection(
    title: String,
    pendingCandidates: List<Pair<ShiftSwapRequest, com.reguerta.user.domain.shifts.ShiftSwapCandidate>>,
    shifts: List<ShiftAssignment>,
    deliveryCalendarOverrides: List<DeliveryCalendarOverride>,
    members: List<Member>,
    isUpdating: Boolean,
    onAccept: (String, String) -> Unit,
    onReject: (String, String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = title,
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.primary,
            fontWeight = FontWeight.SemiBold,
        )
        pendingCandidates.sortedByDescending { it.first.requestedAtMillis }.forEach { (request, candidate) ->
            val requestedShift = shifts.firstOrNull { it.id == request.requestedShiftId }
            val candidateShift = shifts.firstOrNull { it.id == candidate.shiftId }
            Card {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(
                        text = stringResource(
                            R.string.shift_swap_request_requested_by_format,
                            members.displayNameFor(request.requesterUserId),
                        ),
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = stringResource(
                            R.string.shift_swap_request_shift_format,
                            requestedShift?.toShiftSwapDisplayLabel(request.requesterUserId, deliveryCalendarOverrides).orEmpty().ifBlank { request.requestedShiftId },
                        ),
                        style = MaterialTheme.typography.bodySmall,
                    )
                    Text(
                        text = stringResource(
                            R.string.shift_swap_request_offer_shift_format,
                            candidateShift?.toShiftSwapDisplayLabel(candidate.userId, deliveryCalendarOverrides).orEmpty().ifBlank { candidate.shiftId },
                        ),
                        style = MaterialTheme.typography.bodySmall,
                    )
                    if (request.reason.isNotBlank()) {
                        Text(
                            text = stringResource(R.string.shift_swap_request_reason_format, request.reason),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        ReguertaButton(
                            label = stringResource(R.string.shift_swap_request_accept_short),
                            variant = ReguertaButtonVariant.PRIMARY,
                            fullWidth = false,
                            enabled = !isUpdating,
                            onClick = { onAccept(request.id, candidate.shiftId) },
                        )
                        ReguertaButton(
                            label = stringResource(R.string.shift_swap_request_reject_short),
                            variant = ReguertaButtonVariant.SECONDARY,
                            fullWidth = false,
                            enabled = !isUpdating,
                            onClick = { onReject(request.id, candidate.shiftId) },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun RequesterResponsesSection(
    title: String,
    responseOptions: List<Triple<ShiftSwapRequest, com.reguerta.user.domain.shifts.ShiftSwapCandidate, com.reguerta.user.domain.shifts.ShiftSwapResponse>>,
    shifts: List<ShiftAssignment>,
    deliveryCalendarOverrides: List<DeliveryCalendarOverride>,
    members: List<Member>,
    isUpdating: Boolean,
    onConfirm: (String, String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = title,
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.primary,
            fontWeight = FontWeight.SemiBold,
        )
        responseOptions.sortedByDescending { it.first.requestedAtMillis }.forEach { (request, candidate, _) ->
            val requestedShift = shifts.firstOrNull { it.id == request.requestedShiftId }
            val candidateShift = shifts.firstOrNull { it.id == candidate.shiftId }
            Card {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(
                        text = members.displayNameFor(candidate.userId),
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = stringResource(
                            R.string.shift_swap_request_confirm_before_after_format,
                            requestedShift?.toShiftSwapDisplayLabel(request.requesterUserId, deliveryCalendarOverrides).orEmpty().ifBlank { request.requestedShiftId },
                            candidateShift?.toShiftSwapDisplayLabel(candidate.userId, deliveryCalendarOverrides).orEmpty().ifBlank { candidate.shiftId },
                        ),
                        style = MaterialTheme.typography.bodySmall,
                    )
                    ReguertaButton(
                        label = stringResource(R.string.shift_swap_request_confirm),
                        variant = ReguertaButtonVariant.PRIMARY,
                        fullWidth = false,
                        enabled = !isUpdating,
                        onClick = { onConfirm(request.id, candidate.shiftId) },
                    )
                }
            }
        }
    }
}

@Composable
private fun WaitingShiftSwapSection(
    title: String,
    requests: List<ShiftSwapRequest>,
    shifts: List<ShiftAssignment>,
    deliveryCalendarOverrides: List<DeliveryCalendarOverride>,
    members: List<Member>,
    onCancel: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = title,
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.primary,
            fontWeight = FontWeight.SemiBold,
        )
        requests.sortedByDescending { it.requestedAtMillis }.forEach { request ->
            val requestedShift = shifts.firstOrNull { it.id == request.requestedShiftId }
            Card {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(
                        text = requestedShift?.toShiftSwapDisplayLabel(request.requesterUserId, deliveryCalendarOverrides) ?: request.requestedShiftId,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = stringResource(R.string.shift_swap_request_waiting_multiple_format, request.candidates.map { members.displayNameFor(it.userId) }.distinct().size),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    ReguertaButton(
                        label = stringResource(R.string.shift_swap_request_cancel),
                        variant = ReguertaButtonVariant.SECONDARY,
                        fullWidth = false,
                        onClick = { onCancel(request.id) },
                    )
                }
            }
        }
    }
}

@Composable
private fun HistoryShiftSwapSection(
    title: String,
    requests: List<ShiftSwapRequest>,
    shifts: List<ShiftAssignment>,
    deliveryCalendarOverrides: List<DeliveryCalendarOverride>,
    members: List<Member>,
    onDismissRequest: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = title,
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.primary,
            fontWeight = FontWeight.SemiBold,
        )
        requests.sortedByDescending { it.requestedAtMillis }.forEach { request ->
            ShiftSwapRequestHistoryItem(
                request = request,
                shift = shifts.firstOrNull { it.id == request.requestedShiftId },
                deliveryCalendarOverrides = deliveryCalendarOverrides,
                members = members,
                onDismiss = onDismissRequest,
            )
        }
    }
}

@Composable
private fun ShiftSwapRequestHistoryItem(
    request: ShiftSwapRequest,
    shift: ShiftAssignment?,
    deliveryCalendarOverrides: List<DeliveryCalendarOverride>,
    members: List<Member>,
    onDismiss: (String) -> Unit,
) {
    Card {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = shift?.toShiftSwapDisplayLabel(request.requesterUserId, deliveryCalendarOverrides) ?: request.requestedShiftId,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = stringResource(
                    R.string.shift_swap_request_requested_by_format,
                    members.displayNameFor(request.requesterUserId),
                ),
                style = MaterialTheme.typography.bodySmall,
            )
            Text(
                text = stringResource(
                    R.string.shift_swap_request_reason_format,
                    request.reason.ifBlank { stringResource(R.string.shift_swap_request_reason_empty) },
                ),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = stringResource(request.status.labelRes()),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary,
            )
            request.selectedCandidateUserId?.let { selectedUserId ->
                Text(
                    text = stringResource(
                        R.string.shift_swap_request_selected_candidate_format,
                        members.displayNameFor(selectedUserId),
                    ),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (request.status == ShiftSwapRequestStatus.APPLIED) {
                ReguertaFlatButton(
                    label = stringResource(R.string.shift_swap_request_acknowledge),
                    onClick = { onDismiss(request.id) },
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

@Composable
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

private fun List<Member>.displayNameFor(memberId: String): String =
    firstOrNull { member -> member.id == memberId }?.displayName ?: memberId

private fun ShiftSwapRequest.availableResponses(): List<com.reguerta.user.domain.shifts.ShiftSwapResponse> =
    responses.filter { it.status == com.reguerta.user.domain.shifts.ShiftSwapResponseStatus.AVAILABLE }
