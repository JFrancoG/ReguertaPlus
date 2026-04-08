package com.reguerta.user.presentation.access

import com.reguerta.user.R
import com.reguerta.user.domain.calendar.DeliveryCalendarRepository
import com.reguerta.user.domain.calendar.DeliveryWeekday
import com.reguerta.user.domain.notifications.NotificationEvent
import com.reguerta.user.domain.notifications.NotificationRepository
import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.domain.shifts.ShiftPlanningRequest
import com.reguerta.user.domain.shifts.ShiftPlanningRequestRepository
import com.reguerta.user.domain.shifts.ShiftPlanningRequestStatus
import com.reguerta.user.domain.shifts.ShiftPlanningRequestType
import com.reguerta.user.domain.shifts.ShiftRepository
import com.reguerta.user.domain.shifts.ShiftSwapRequest
import com.reguerta.user.domain.shifts.ShiftSwapRequestRepository
import com.reguerta.user.domain.shifts.ShiftSwapRequestStatus
import com.reguerta.user.domain.shifts.ShiftSwapResponse
import com.reguerta.user.domain.shifts.ShiftSwapResponseStatus
import com.reguerta.user.domain.shifts.ShiftType
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

internal class SessionShiftActions(
    private val uiState: MutableStateFlow<SessionUiState>,
    private val scope: CoroutineScope,
    private val shiftRepository: ShiftRepository,
    private val deliveryCalendarRepository: DeliveryCalendarRepository,
    private val shiftPlanningRequestRepository: ShiftPlanningRequestRepository,
    private val shiftSwapRequestRepository: ShiftSwapRequestRepository,
    private val notificationRepository: NotificationRepository,
    private val nowMillisProvider: () -> Long,
    private val emitMessage: (Int) -> Unit,
) {
    fun refreshShifts() {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        scope.launch {
            uiState.update { it.copy(isLoadingShifts = true) }
            val shifts = shiftRepository.getAllShifts()
            val requests = shiftSwapRequestRepository.getAllShiftSwapRequests()
            uiState.update {
                val currentMode = it.mode as? SessionMode.Authorized
                if (currentMode?.principal?.uid != mode.principal.uid) {
                    it
                } else {
                    it.copy(
                        shiftsFeed = shifts,
                        shiftSwapRequests = requests.visibleTo(mode.member.id),
                        nextDeliveryShift = shifts.nextAssignedShift(
                            memberId = mode.member.id,
                            type = ShiftType.DELIVERY,
                            nowMillis = nowMillisProvider(),
                        ),
                        nextMarketShift = shifts.nextAssignedShift(
                            memberId = mode.member.id,
                            type = ShiftType.MARKET,
                            nowMillis = nowMillisProvider(),
                        ),
                        isLoadingShifts = false,
                    )
                }
            }
        }
    }

    fun refreshDeliveryCalendar() {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.isAdmin) return
        scope.launch {
            uiState.update { it.copy(isLoadingDeliveryCalendar = true) }
            val defaultDay = deliveryCalendarRepository.getDefaultDeliveryDayOfWeek()
            val overrides = deliveryCalendarRepository.getAllOverrides()
            uiState.update {
                val currentMode = it.mode as? SessionMode.Authorized
                if (currentMode?.principal?.uid != mode.principal.uid) {
                    it
                } else {
                    it.copy(
                        defaultDeliveryDayOfWeek = defaultDay,
                        deliveryCalendarOverrides = overrides,
                        isLoadingDeliveryCalendar = false,
                    )
                }
            }
        }
    }

    fun saveDeliveryCalendarOverride(
        weekKey: String,
        weekday: DeliveryWeekday,
        updatedByUserId: String,
        onSuccess: () -> Unit = {},
    ) {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.isAdmin) return
        scope.launch {
            uiState.update { it.copy(isSavingDeliveryCalendar = true) }
            val now = nowMillisProvider()
            val override = buildDeliveryCalendarOverride(
                weekKey = weekKey,
                weekday = weekday,
                updatedByUserId = updatedByUserId,
                updatedAtMillis = now,
            ) ?: run {
                uiState.update { it.copy(isSavingDeliveryCalendar = false) }
                return@launch
            }
            deliveryCalendarRepository.upsertOverride(override)
            val defaultDay = deliveryCalendarRepository.getDefaultDeliveryDayOfWeek()
            val overrides = deliveryCalendarRepository.getAllOverrides()
            uiState.update {
                it.copy(
                    defaultDeliveryDayOfWeek = defaultDay,
                    deliveryCalendarOverrides = overrides,
                    isSavingDeliveryCalendar = false,
                )
            }
            onSuccess()
        }
    }

    fun deleteDeliveryCalendarOverride(
        weekKey: String,
        onSuccess: () -> Unit = {},
    ) {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.isAdmin) return
        scope.launch {
            uiState.update { it.copy(isSavingDeliveryCalendar = true) }
            deliveryCalendarRepository.deleteOverride(weekKey)
            val defaultDay = deliveryCalendarRepository.getDefaultDeliveryDayOfWeek()
            val overrides = deliveryCalendarRepository.getAllOverrides()
            uiState.update {
                it.copy(
                    defaultDeliveryDayOfWeek = defaultDay,
                    deliveryCalendarOverrides = overrides,
                    isSavingDeliveryCalendar = false,
                )
            }
            onSuccess()
        }
    }

    fun submitShiftPlanningRequest(
        type: ShiftPlanningRequestType,
        onSuccess: () -> Unit = {},
    ) {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        if (!mode.member.isAdmin) return
        scope.launch {
            uiState.update { it.copy(isSubmittingShiftPlanningRequest = true) }
            shiftPlanningRequestRepository.submitShiftPlanningRequest(
                ShiftPlanningRequest(
                    id = "",
                    type = type,
                    requestedByUserId = mode.member.id,
                    requestedAtMillis = nowMillisProvider(),
                    status = ShiftPlanningRequestStatus.REQUESTED,
                ),
            )
            uiState.update { it.copy(isSubmittingShiftPlanningRequest = false) }
            onSuccess()
        }
    }

    fun saveShiftSwapRequest(onSuccess: () -> Unit = {}) {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        val draft = uiState.value.shiftSwapDraft
        if (draft.shiftId.isBlank()) {
            return
        }
        val shift = uiState.value.shiftsFeed.firstOrNull { it.id == draft.shiftId } ?: return
        val candidates = shift.swapCandidates(
            allShifts = uiState.value.shiftsFeed,
            requesterUserId = mode.member.id,
            nowMillis = nowMillisProvider(),
        )
        if (candidates.isEmpty()) {
            emitMessage(R.string.feedback_shift_swap_no_candidates)
            return
        }

        scope.launch {
            uiState.update { it.copy(isSavingShiftSwapRequest = true) }
            val persisted = shiftSwapRequestRepository.upsertShiftSwapRequest(
                ShiftSwapRequest(
                    id = "",
                    requestedShiftId = shift.id,
                    requesterUserId = mode.member.id,
                    reason = draft.reason.trim(),
                    status = ShiftSwapRequestStatus.OPEN,
                    candidates = candidates,
                    responses = emptyList(),
                    selectedCandidateUserId = null,
                    selectedCandidateShiftId = null,
                    requestedAtMillis = nowMillisProvider(),
                    confirmedAtMillis = null,
                    appliedAtMillis = null,
                ),
            )
            sendShiftSwapNotification(
                title = "Solicitud de cambio de turno",
                body = "${mode.member.displayName} solicita cambio para el turno del ${shift.dateMillis.toShiftNotificationDateTime()}",
                type = "shift_swap_requested",
                targetUserIds = persisted.candidates.map { it.userId }.distinct(),
                createdBy = mode.member.id,
            )
            val allRequests = shiftSwapRequestRepository.getAllShiftSwapRequests()
            uiState.update {
                it.copy(
                    shiftSwapRequests = allRequests.visibleTo(mode.member.id),
                    shiftSwapDraft = ShiftSwapDraft(),
                    isSavingShiftSwapRequest = false,
                )
            }
            onSuccess()
        }
    }

    fun acceptShiftSwapRequest(requestId: String, candidateShiftId: String) {
        respondToShiftSwapRequest(
            requestId = requestId,
            candidateShiftId = candidateShiftId,
            responseStatus = ShiftSwapResponseStatus.AVAILABLE,
        )
    }

    fun rejectShiftSwapRequest(requestId: String, candidateShiftId: String) {
        respondToShiftSwapRequest(
            requestId = requestId,
            candidateShiftId = candidateShiftId,
            responseStatus = ShiftSwapResponseStatus.UNAVAILABLE,
        )
    }

    fun cancelShiftSwapRequest(requestId: String) {
        updateShiftSwapRequest(requestId) { request, _, _ ->
            request.copy(
                status = ShiftSwapRequestStatus.CANCELLED,
            )
        }
    }

    fun confirmShiftSwapRequest(requestId: String, candidateShiftId: String) {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        val request = uiState.value.shiftSwapRequests.firstOrNull { it.id == requestId } ?: return
        val requestedShift = uiState.value.shiftsFeed.firstOrNull { it.id == request.requestedShiftId } ?: return
        val candidate = request.candidates.firstOrNull { it.shiftId == candidateShiftId } ?: return
        val candidateShift = uiState.value.shiftsFeed.firstOrNull { it.id == candidate.shiftId } ?: return

        scope.launch {
            uiState.update { it.copy(isUpdatingShiftSwapRequest = true) }
            val now = nowMillisProvider()
            val updatedRequest = request.copy(
                status = ShiftSwapRequestStatus.APPLIED,
                selectedCandidateUserId = candidate.userId,
                selectedCandidateShiftId = candidate.shiftId,
                confirmedAtMillis = now,
                appliedAtMillis = now,
            )
            val (updatedRequestedShift, updatedCandidateShift) = requestedShift.swapMemberWith(
                other = candidateShift,
                requesterUserId = request.requesterUserId,
                responderUserId = candidate.userId,
                nowMillis = now,
            )
            shiftSwapRequestRepository.upsertShiftSwapRequest(updatedRequest)
            val existingShifts = shiftRepository.getAllShifts()
            val shiftsToPersist = existingShifts.applyConfirmedSwap(
                updatedRequestedShift = updatedRequestedShift,
                updatedCandidateShift = updatedCandidateShift,
                nowMillis = now,
            )
            shiftsToPersist.forEach { shiftRepository.upsertShift(it) }
            sendShiftSwapNotification(
                title = "Cambio de turno aplicado",
                body = "Se ha confirmado el cambio entre ${mode.member.displayName} y ${mode.members.sessionDisplayNameFor(candidate.userId)} para ${requestedShift.dateMillis.toShiftNotificationDateTime()} y ${candidateShift.dateMillis.toShiftNotificationDateTime()}.",
                type = "shift_swap_applied",
                targetUserIds = mode.members.filter { it.isActive }.map { it.id }.distinct(),
                createdBy = mode.member.id,
            )
            val allRequests = shiftSwapRequestRepository.getAllShiftSwapRequests()
            val allShifts = shiftRepository.getAllShifts()
            uiState.update {
                it.copy(
                    shiftSwapRequests = allRequests.visibleTo(mode.member.id),
                    shiftsFeed = allShifts,
                    nextDeliveryShift = allShifts.nextAssignedShift(mode.member.id, ShiftType.DELIVERY, nowMillisProvider()),
                    nextMarketShift = allShifts.nextAssignedShift(mode.member.id, ShiftType.MARKET, nowMillisProvider()),
                    isUpdatingShiftSwapRequest = false,
                )
            }
        }
    }

    private fun updateShiftSwapRequest(
        requestId: String,
        transform: (ShiftSwapRequest, SessionMode.Authorized, Long) -> ShiftSwapRequest,
    ) {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        val request = uiState.value.shiftSwapRequests.firstOrNull { it.id == requestId } ?: return

        scope.launch {
            uiState.update { it.copy(isUpdatingShiftSwapRequest = true) }
            val now = nowMillisProvider()
            val updatedRequest = transform(request, mode, now)
            shiftSwapRequestRepository.upsertShiftSwapRequest(updatedRequest)
            val allRequests = shiftSwapRequestRepository.getAllShiftSwapRequests()
            val allShifts = shiftRepository.getAllShifts()
            uiState.update {
                it.copy(
                    shiftSwapRequests = allRequests.visibleTo(mode.member.id),
                    shiftsFeed = allShifts,
                    nextDeliveryShift = allShifts.nextAssignedShift(mode.member.id, ShiftType.DELIVERY, nowMillisProvider()),
                    nextMarketShift = allShifts.nextAssignedShift(mode.member.id, ShiftType.MARKET, nowMillisProvider()),
                    isUpdatingShiftSwapRequest = false,
                )
            }
        }
    }

    private fun respondToShiftSwapRequest(
        requestId: String,
        candidateShiftId: String,
        responseStatus: ShiftSwapResponseStatus,
    ) {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        val request = uiState.value.shiftSwapRequests.firstOrNull { it.id == requestId } ?: return
        val candidate = request.candidates.firstOrNull { it.userId == mode.member.id && it.shiftId == candidateShiftId } ?: return
        val requestedShift = uiState.value.shiftsFeed.firstOrNull { it.id == request.requestedShiftId } ?: return
        val candidateShift = uiState.value.shiftsFeed.firstOrNull { it.id == candidate.shiftId }

        scope.launch {
            uiState.update { it.copy(isUpdatingShiftSwapRequest = true) }
            val now = nowMillisProvider()
            val updatedResponses = request.responses
                .filterNot { it.userId == candidate.userId && it.shiftId == candidate.shiftId }
                .plus(
                    ShiftSwapResponse(
                        userId = candidate.userId,
                        shiftId = candidate.shiftId,
                        status = responseStatus,
                        respondedAtMillis = now,
                    ),
                )
                .sortedByDescending { it.respondedAtMillis }
            val updatedRequest = request.copy(responses = updatedResponses)
            shiftSwapRequestRepository.upsertShiftSwapRequest(updatedRequest)
            sendShiftSwapNotification(
                title = if (responseStatus == ShiftSwapResponseStatus.AVAILABLE) {
                    "Socio disponible para cambio"
                } else {
                    "Socio no disponible para cambio"
                },
                body = buildString {
                    append(mode.member.displayName)
                    append(
                        if (responseStatus == ShiftSwapResponseStatus.AVAILABLE) {
                            " puede cubrir "
                        } else {
                            " no puede cubrir "
                        },
                    )
                    append(requestedShift.dateMillis.toShiftNotificationDateTime())
                    candidateShift?.let {
                        append(" desde su turno del ")
                        append(it.dateMillis.toShiftNotificationDateTime())
                    }
                },
                type = if (responseStatus == ShiftSwapResponseStatus.AVAILABLE) {
                    "shift_swap_available"
                } else {
                    "shift_swap_unavailable"
                },
                targetUserIds = listOf(request.requesterUserId),
                createdBy = mode.member.id,
            )
            val allRequests = shiftSwapRequestRepository.getAllShiftSwapRequests()
            uiState.update {
                it.copy(
                    shiftSwapRequests = allRequests.visibleTo(mode.member.id),
                    isUpdatingShiftSwapRequest = false,
                )
            }
        }
    }

    private suspend fun sendShiftSwapNotification(
        title: String,
        body: String,
        type: String,
        targetUserIds: List<String>,
        createdBy: String,
    ) {
        notificationRepository.sendNotification(
            NotificationEvent(
                id = "",
                title = title,
                body = body,
                type = type,
                target = "users",
                userIds = targetUserIds,
                segmentType = null,
                targetRole = null,
                createdBy = createdBy,
                sentAtMillis = nowMillisProvider(),
                weekKey = null,
            ),
        )
    }
}
