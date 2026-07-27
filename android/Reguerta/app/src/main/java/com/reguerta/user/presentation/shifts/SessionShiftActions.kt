package com.reguerta.user.presentation.shifts

import com.reguerta.user.presentation.root.SessionMode
import com.reguerta.user.presentation.root.SessionUiState
import com.reguerta.user.presentation.root.ShiftSwapDraft
import com.reguerta.user.presentation.root.buildDeliveryCalendarOverride
import com.reguerta.user.presentation.root.nextAssignedShift
import com.reguerta.user.presentation.root.swapCandidates
import com.reguerta.user.presentation.root.visibleTo

import com.reguerta.user.R
import com.reguerta.user.domain.calendar.DeliveryCalendarRepository
import com.reguerta.user.domain.calendar.DeliveryWeekday
import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.domain.shifts.ShiftPlanningRequest
import com.reguerta.user.domain.shifts.ShiftPlanningRequestRepository
import com.reguerta.user.domain.shifts.ShiftPlanningRequestStatus
import com.reguerta.user.domain.shifts.ShiftPlanningRequestType
import com.reguerta.user.domain.shifts.ShiftRepository
import com.reguerta.user.domain.shifts.ShiftSwapRequest
import com.reguerta.user.domain.shifts.ShiftSwapRequestRepository
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
            val calendarState = uiState.value
            val shouldDeleteOverride = shouldDeleteDeliveryCalendarOverride(
                hasExistingOverride = calendarState.deliveryCalendarOverrides.any { it.weekKey == weekKey },
                selectedWeekday = weekday,
                defaultWeekday = calendarState.defaultDeliveryDayOfWeek,
            )
            if (shouldDeleteOverride) {
                deliveryCalendarRepository.deleteOverride(weekKey)
            } else {
                val override = buildDeliveryCalendarOverride(
                    weekKey = weekKey,
                    weekday = weekday,
                    updatedByUserId = updatedByUserId,
                    updatedAtMillis = nowMillisProvider(),
                ) ?: run {
                    uiState.update { it.copy(isSavingDeliveryCalendar = false) }
                    return@launch
                }
                deliveryCalendarRepository.upsertOverride(override)
            }
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
            runCatching {
                shiftSwapRequestRepository.createShiftSwapRequest(
                    requestedShiftId = shift.id,
                    reason = draft.reason,
                )
                shiftSwapRequestRepository.getAllShiftSwapRequests()
            }.onSuccess { allRequests ->
                uiState.update {
                    it.copy(
                        shiftSwapRequests = allRequests.visibleTo(mode.member.id),
                        shiftSwapDraft = ShiftSwapDraft(),
                        isSavingShiftSwapRequest = false,
                    )
                }
                onSuccess()
            }.onFailure {
                uiState.update { it.copy(isSavingShiftSwapRequest = false) }
                emitMessage(R.string.feedback_shift_swap_update_failed)
            }
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
        updateShiftSwapRequest(requestId) { request ->
            shiftSwapRequestRepository.cancelShiftSwapRequest(request.id)
        }
    }

    fun confirmShiftSwapRequest(requestId: String, candidateShiftId: String) {
        val request = uiState.value.shiftSwapRequests.firstOrNull { it.id == requestId } ?: return
        if (request.candidates.none { it.shiftId == candidateShiftId }) return
        updateShiftSwapRequest(requestId) { currentRequest ->
            shiftSwapRequestRepository.applyShiftSwapRequest(
                requestId = currentRequest.id,
                candidateShiftId = candidateShiftId,
            )
        }
    }

    private fun updateShiftSwapRequest(
        requestId: String,
        transition: suspend (ShiftSwapRequest) -> Unit,
    ) {
        val mode = uiState.value.mode as? SessionMode.Authorized ?: return
        val request = uiState.value.shiftSwapRequests.firstOrNull { it.id == requestId } ?: return

        scope.launch {
            uiState.update { it.copy(isUpdatingShiftSwapRequest = true) }
            runCatching {
                transition(request)
                shiftSwapRequestRepository.getAllShiftSwapRequests() to shiftRepository.getAllShifts()
            }.onSuccess { (allRequests, allShifts) ->
                uiState.update {
                    it.copy(
                        shiftSwapRequests = allRequests.visibleTo(mode.member.id),
                        shiftsFeed = allShifts,
                        nextDeliveryShift = allShifts.nextAssignedShift(mode.member.id, ShiftType.DELIVERY, nowMillisProvider()),
                        nextMarketShift = allShifts.nextAssignedShift(mode.member.id, ShiftType.MARKET, nowMillisProvider()),
                        isUpdatingShiftSwapRequest = false,
                    )
                }
            }.onFailure {
                uiState.update { it.copy(isUpdatingShiftSwapRequest = false) }
                emitMessage(R.string.feedback_shift_swap_update_failed)
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
        updateShiftSwapRequest(requestId) { currentRequest ->
            shiftSwapRequestRepository.respondToShiftSwapRequest(
                requestId = currentRequest.id,
                candidateShiftId = candidate.shiftId,
                response = responseStatus,
            )
        }
    }
}

internal fun shouldDeleteDeliveryCalendarOverride(
    hasExistingOverride: Boolean,
    selectedWeekday: DeliveryWeekday,
    defaultWeekday: DeliveryWeekday?,
): Boolean = hasExistingOverride && selectedWeekday == defaultWeekday
