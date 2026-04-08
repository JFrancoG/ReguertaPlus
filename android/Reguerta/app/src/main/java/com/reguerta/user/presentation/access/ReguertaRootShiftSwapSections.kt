package com.reguerta.user.presentation.access

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.reguerta.user.R
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.calendar.DeliveryCalendarOverride
import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.domain.shifts.ShiftSwapCandidate
import com.reguerta.user.domain.shifts.ShiftSwapRequest
import com.reguerta.user.domain.shifts.ShiftSwapRequestStatus
import com.reguerta.user.domain.shifts.ShiftSwapResponse
import com.reguerta.user.domain.shifts.ShiftSwapResponseStatus
import com.reguerta.user.ui.components.auth.ReguertaButton
import com.reguerta.user.ui.components.auth.ReguertaButtonVariant
import com.reguerta.user.ui.components.auth.ReguertaFlatButton

@Composable
internal fun ShiftSwapRequestsCard(
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
                request.shiftSwapAvailableResponses().mapNotNull { response ->
                    val candidate = request.candidates.firstOrNull { it.userId == response.userId && it.shiftId == response.shiftId }
                    candidate?.let { Triple(request, it, response) }
                }
            }
            val waiting = requesterOpen.filter { request -> request.shiftSwapAvailableResponses().isEmpty() }
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
    pendingCandidates: List<Pair<ShiftSwapRequest, ShiftSwapCandidate>>,
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
                            members.shiftSwapDisplayNameFor(request.requesterUserId),
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
    responseOptions: List<Triple<ShiftSwapRequest, ShiftSwapCandidate, ShiftSwapResponse>>,
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
                        text = members.shiftSwapDisplayNameFor(candidate.userId),
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
                        text = stringResource(R.string.shift_swap_request_waiting_multiple_format, request.candidates.map { members.shiftSwapDisplayNameFor(it.userId) }.distinct().size),
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
                    members.shiftSwapDisplayNameFor(request.requesterUserId),
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
                        members.shiftSwapDisplayNameFor(selectedUserId),
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

private fun List<Member>.shiftSwapDisplayNameFor(memberId: String): String =
    firstOrNull { member -> member.id == memberId }?.displayName ?: memberId

private fun ShiftSwapRequest.shiftSwapAvailableResponses(): List<ShiftSwapResponse> =
    responses.filter { it.status == ShiftSwapResponseStatus.AVAILABLE }
