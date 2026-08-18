package com.reguerta.user.presentation.shifts

import com.reguerta.user.R
import com.reguerta.user.domain.calendar.DeliveryCalendarOverride
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
import com.reguerta.user.domain.shifts.ShiftSwapRequestStatus
import com.reguerta.user.domain.shifts.ShiftSwapResponseStatus
import com.reguerta.user.domain.shifts.ShiftType
import com.reguerta.user.presentation.root.SessionMode
import com.reguerta.user.presentation.root.SessionUiState
import com.reguerta.user.presentation.root.HOME_LOAD_AUTOMATIC_RETRY_DELAY_MILLIS
import com.reguerta.user.presentation.root.ShiftSwapDraft
import com.reguerta.user.presentation.root.buildDeliveryCalendarOverride
import com.reguerta.user.presentation.root.nextAssignedShift
import com.reguerta.user.presentation.root.swapCandidates
import com.reguerta.user.presentation.root.visibleTo
import java.util.UUID
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
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
    private val automaticLoadRetryDelayMillis: Long? = HOME_LOAD_AUTOMATIC_RETRY_DELAY_MILLIS,
) {
    init {
        require(automaticLoadRetryDelayMillis == null || automaticLoadRetryDelayMillis > 0L) {
            "Automatic load retry delay must be positive"
        }
    }

    private var nextOperationToken = 0L
    private var activeShiftRefresh: ShiftOperation? = null
    private var shiftRetryJob: Job? = null
    private var activeCalendarRefresh: ShiftOperation? = null
    private var calendarRetryJob: Job? = null
    private var activeCalendarMutation: ShiftOperation? = null
    private var activePlanningMutation: ShiftOperation? = null
    private var activeSwapCreate: ShiftOperation? = null
    private var activeSwapUpdate: ShiftOperation? = null
    private var pendingPlanningRequest: PendingPlanningRequest? = null
    private val acknowledgedSwapTransitions = mutableMapOf<String, PendingAcknowledgedSwapTransition>()

    fun refreshShifts() {
        shiftRetryJob?.cancel()
        shiftRetryJob = null
        refreshShiftsAttempt(retryOnFailure = true)
    }

    private fun refreshShiftsAttempt(retryOnFailure: Boolean) {
        val initialState = uiState.value
        val mode = initialState.mode as? SessionMode.Authorized ?: return
        val context = ShiftSessionContext.from(initialState, mode)
        pruneAcknowledgedSwapTransitions(
            context = context,
            acknowledgedRequestIds = initialState.acknowledgedShiftSwapRequestIds,
        )
        val operation = nextOperation(context).also { activeShiftRefresh = it }
        if (!updateIfCurrent(context) { it.copy(isLoadingShifts = true) }) {
            activeShiftRefresh = null
            return
        }
        scope.launch {
            try {
                val shifts = shiftRepository.getAllShifts()
                val requests = shiftSwapRequestRepository.getAllShiftSwapRequests()
                if (activeShiftRefresh != operation) return@launch
                activeShiftRefresh = null
                val reflectedAcknowledgements = reflectedAcknowledgementIds(
                    context = context,
                    acknowledgedRequestIds = uiState.value.acknowledgedShiftSwapRequestIds,
                    requests = requests,
                )
                val reflectedCreateAcknowledgements = reflectedShiftSwapCreateAcknowledgementIds(
                    context = context,
                    acknowledgedCreates = uiState.value.acknowledgedShiftSwapCreates,
                    requests = requests,
                )
                val didPublish = updateIfCurrent(context) {
                    it.copy(
                        shiftsFeed = shifts,
                        shiftSwapRequests = requests.visibleTo(context.memberId),
                        acknowledgedShiftSwapRequestIds =
                            it.acknowledgedShiftSwapRequestIds - reflectedAcknowledgements,
                        acknowledgedShiftSwapCreates =
                            it.acknowledgedShiftSwapCreates - reflectedCreateAcknowledgements,
                        nextDeliveryShift = shifts.nextAssignedShift(
                            memberId = context.memberId,
                            type = ShiftType.DELIVERY,
                            nowMillis = nowMillisProvider(),
                        ),
                        nextMarketShift = shifts.nextAssignedShift(
                            memberId = context.memberId,
                            type = ShiftType.MARKET,
                            nowMillis = nowMillisProvider(),
                        ),
                        isLoadingShifts = false,
                    )
                }
                if (didPublish) {
                    reflectedAcknowledgements.forEach(acknowledgedSwapTransitions::remove)
                }
            } catch (cancellation: CancellationException) {
                finishShiftRefresh(operation)
                throw cancellation
            } catch (_: Exception) {
                if (!finishShiftRefresh(operation)) return@launch
                if (retryOnFailure && scheduleShiftRetry(context)) return@launch
                if (isCurrent(context)) {
                    emitMessage(R.string.feedback_unable_load_data)
                }
            }
        }
    }

    fun refreshDeliveryCalendar() {
        calendarRetryJob?.cancel()
        calendarRetryJob = null
        refreshDeliveryCalendarAttempt(retryOnFailure = true)
    }

    private fun refreshDeliveryCalendarAttempt(retryOnFailure: Boolean) {
        val initialState = uiState.value
        val mode = initialState.mode as? SessionMode.Authorized ?: return
        if (!mode.member.isAdmin) return
        val context = ShiftSessionContext.from(initialState, mode)
        val operation = nextOperation(context).also { activeCalendarRefresh = it }
        if (!updateIfCurrent(context) { it.copy(isLoadingDeliveryCalendar = true) }) {
            activeCalendarRefresh = null
            return
        }
        scope.launch {
            try {
                val defaultDay = deliveryCalendarRepository.getDefaultDeliveryDayOfWeek()
                val overrides = deliveryCalendarRepository.getAllOverrides()
                if (activeCalendarRefresh != operation) return@launch
                activeCalendarRefresh = null
                updateIfCurrent(context) {
                    it.copy(
                        defaultDeliveryDayOfWeek = defaultDay,
                        deliveryCalendarOverrides = overrides,
                        isLoadingDeliveryCalendar = false,
                    )
                }
            } catch (cancellation: CancellationException) {
                finishCalendarRefresh(operation)
                throw cancellation
            } catch (_: Exception) {
                if (!finishCalendarRefresh(operation)) return@launch
                if (retryOnFailure && scheduleCalendarRetry(context)) return@launch
                if (isCurrent(context)) {
                    emitMessage(R.string.feedback_unable_load_data)
                }
            }
        }
    }

    private fun scheduleShiftRetry(context: ShiftSessionContext): Boolean {
        val retryDelayMillis = automaticLoadRetryDelayMillis ?: return false
        lateinit var retryJob: Job
        retryJob = scope.launch(start = CoroutineStart.LAZY) {
            delay(retryDelayMillis)
            if (shiftRetryJob !== retryJob) return@launch
            shiftRetryJob = null
            if (!isCurrent(context)) return@launch
            refreshShiftsAttempt(retryOnFailure = false)
        }
        shiftRetryJob?.cancel()
        shiftRetryJob = retryJob
        retryJob.start()
        return true
    }

    private fun scheduleCalendarRetry(context: ShiftSessionContext): Boolean {
        val retryDelayMillis = automaticLoadRetryDelayMillis ?: return false
        lateinit var retryJob: Job
        retryJob = scope.launch(start = CoroutineStart.LAZY) {
            delay(retryDelayMillis)
            if (calendarRetryJob !== retryJob) return@launch
            calendarRetryJob = null
            if (!isCurrent(context)) return@launch
            refreshDeliveryCalendarAttempt(retryOnFailure = false)
        }
        calendarRetryJob?.cancel()
        calendarRetryJob = retryJob
        retryJob.start()
        return true
    }

    fun saveDeliveryCalendarOverride(
        weekKey: String,
        weekday: DeliveryWeekday,
        updatedByUserId: String,
        onSuccess: () -> Unit = {},
    ) {
        val initialState = uiState.value
        val mode = initialState.mode as? SessionMode.Authorized ?: return
        if (!mode.member.isAdmin || initialState.isSavingDeliveryCalendar) return
        val context = ShiftSessionContext.from(initialState, mode)
        val shouldDeleteOverride = shouldDeleteDeliveryCalendarOverride(
            hasExistingOverride = initialState.deliveryCalendarOverrides.any { it.weekKey == weekKey },
            selectedWeekday = weekday,
            defaultWeekday = initialState.defaultDeliveryDayOfWeek,
        )
        val override = if (shouldDeleteOverride) {
            null
        } else {
            buildDeliveryCalendarOverride(
                weekKey = weekKey,
                weekday = weekday,
                updatedByUserId = updatedByUserId,
                updatedAtMillis = nowMillisProvider(),
            ) ?: return
        }
        val operation = nextOperation(context).also { activeCalendarMutation = it }
        if (!updateIfCurrent(context) { it.copy(isSavingDeliveryCalendar = true) }) {
            activeCalendarMutation = null
            return
        }
        scope.launch {
            val persisted = try {
                if (shouldDeleteOverride) {
                    deliveryCalendarRepository.deleteOverride(weekKey)
                    null
                } else {
                    deliveryCalendarRepository.upsertOverride(requireNotNull(override))
                }
            } catch (cancellation: CancellationException) {
                finishCalendarMutation(operation)
                throw cancellation
            } catch (_: Exception) {
                if (finishCalendarMutation(operation)) {
                    emitMessage(R.string.feedback_unable_save_changes)
                }
                return@launch
            }
            if (activeCalendarMutation != operation) return@launch
            activeCalendarMutation = null
            val didApply = updateIfCurrent(context) { state ->
                val updatedOverrides = if (shouldDeleteOverride) {
                    state.deliveryCalendarOverrides.filterNot { it.weekKey == weekKey }
                } else {
                    buildList {
                        addAll(state.deliveryCalendarOverrides.filterNot { it.weekKey == persisted?.weekKey })
                        persisted?.let(::add)
                    }.sortedBy(DeliveryCalendarOverride::weekKey)
                }
                state.copy(
                    deliveryCalendarOverrides = updatedOverrides,
                    isSavingDeliveryCalendar = false,
                )
            }
            if (didApply) {
                onSuccess()
                refreshDeliveryCalendar()
            }
        }
    }

    fun submitShiftPlanningRequest(
        type: ShiftPlanningRequestType,
        onSuccess: () -> Unit = {},
    ) {
        val initialState = uiState.value
        val mode = initialState.mode as? SessionMode.Authorized ?: return
        if (!mode.member.isAdmin || initialState.isSubmittingShiftPlanningRequest) return
        val context = ShiftSessionContext.from(initialState, mode)
        val pending = pendingPlanningRequest
            ?.takeIf { it.context == context && it.type == type }
            ?: PendingPlanningRequest(
                context = context,
                type = type,
                requestId = UUID.randomUUID().toString(),
                requestedAtMillis = nowMillisProvider(),
            ).also { pendingPlanningRequest = it }
        val operation = nextOperation(context).also { activePlanningMutation = it }
        if (!updateIfCurrent(context) { it.copy(isSubmittingShiftPlanningRequest = true) }) {
            activePlanningMutation = null
            return
        }
        scope.launch {
            try {
                shiftPlanningRequestRepository.submitShiftPlanningRequest(
                    ShiftPlanningRequest(
                        id = pending.requestId,
                        type = pending.type,
                        requestedByUserId = context.memberId,
                        requestedAtMillis = pending.requestedAtMillis,
                        status = ShiftPlanningRequestStatus.REQUESTED,
                    ),
                )
            } catch (cancellation: CancellationException) {
                finishPlanningMutation(operation)
                throw cancellation
            } catch (_: Exception) {
                if (finishPlanningMutation(operation)) {
                    emitMessage(R.string.feedback_unable_save_changes)
                }
                return@launch
            }
            if (activePlanningMutation != operation) return@launch
            activePlanningMutation = null
            if (pendingPlanningRequest == pending) pendingPlanningRequest = null
            if (updateIfCurrent(context) { it.copy(isSubmittingShiftPlanningRequest = false) }) {
                onSuccess()
            }
        }
    }

    fun saveShiftSwapRequest(onSuccess: () -> Unit = {}) {
        val initialState = uiState.value
        val mode = initialState.mode as? SessionMode.Authorized ?: return
        if (initialState.isSavingShiftSwapRequest) return
        val context = ShiftSessionContext.from(initialState, mode)
        val draft = initialState.shiftSwapDraft
        if (draft.shiftId.isBlank()) return
        val blockedShiftIds = initialState.shiftSwapRequests.blockedShiftSwapRequestShiftIds(
            currentMemberId = context.memberId,
            acknowledgedCreates = initialState.acknowledgedShiftSwapCreates,
        )
        if (draft.shiftId in blockedShiftIds) return
        val shift = initialState.shiftsFeed.firstOrNull { it.id == draft.shiftId } ?: return
        val candidates = shift.swapCandidates(
            allShifts = initialState.shiftsFeed,
            requesterUserId = context.memberId,
            nowMillis = nowMillisProvider(),
        )
        if (candidates.isEmpty()) {
            emitMessage(R.string.feedback_shift_swap_no_candidates)
            return
        }
        val operation = nextOperation(context).also { activeSwapCreate = it }
        if (!updateIfCurrent(context) { it.copy(isSavingShiftSwapRequest = true) }) {
            activeSwapCreate = null
            return
        }
        scope.launch {
            val acknowledgedRequestId = try {
                shiftSwapRequestRepository.createShiftSwapRequest(
                    requestedShiftId = shift.id,
                    reason = draft.reason,
                )
            } catch (cancellation: CancellationException) {
                finishSwapCreate(operation)
                throw cancellation
            } catch (_: Exception) {
                if (finishSwapCreate(operation)) {
                    emitMessage(R.string.feedback_shift_swap_update_failed)
                }
                return@launch
            }
            if (activeSwapCreate != operation) return@launch
            activeSwapCreate = null
            val didAcknowledge = updateIfCurrent(context) { state ->
                state.copy(
                    acknowledgedShiftSwapCreates =
                        state.acknowledgedShiftSwapCreates + (acknowledgedRequestId to shift.id),
                    shiftSwapDraft = if (state.shiftSwapDraft == draft) ShiftSwapDraft() else state.shiftSwapDraft,
                    isSavingShiftSwapRequest = false,
                )
            }
            if (didAcknowledge) {
                onSuccess()
                refreshShifts()
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
        updateShiftSwapRequest(
            requestId = requestId,
            acknowledgedEffect = AcknowledgedSwapEffect.Cancelled,
        ) { request ->
            shiftSwapRequestRepository.cancelShiftSwapRequest(request.id)
        }
    }

    fun confirmShiftSwapRequest(requestId: String, candidateShiftId: String) {
        val request = uiState.value.shiftSwapRequests.firstOrNull { it.id == requestId } ?: return
        if (request.candidates.none { it.shiftId == candidateShiftId }) return
        updateShiftSwapRequest(
            requestId = requestId,
            acknowledgedEffect = AcknowledgedSwapEffect.Applied(candidateShiftId),
        ) { currentRequest ->
            shiftSwapRequestRepository.applyShiftSwapRequest(
                requestId = currentRequest.id,
                candidateShiftId = candidateShiftId,
            )
        }
    }

    private fun updateShiftSwapRequest(
        requestId: String,
        acknowledgedEffect: AcknowledgedSwapEffect,
        transition: suspend (ShiftSwapRequest) -> Unit,
    ) {
        val initialState = uiState.value
        val mode = initialState.mode as? SessionMode.Authorized ?: return
        if (
            initialState.isUpdatingShiftSwapRequest ||
            requestId in initialState.acknowledgedShiftSwapRequestIds
        ) {
            return
        }
        val context = ShiftSessionContext.from(initialState, mode)
        val request = initialState.shiftSwapRequests.firstOrNull { it.id == requestId } ?: return
        val operation = nextOperation(context).also { activeSwapUpdate = it }
        if (!updateIfCurrent(context) { it.copy(isUpdatingShiftSwapRequest = true) }) {
            activeSwapUpdate = null
            return
        }
        scope.launch {
            try {
                transition(request)
            } catch (cancellation: CancellationException) {
                finishSwapUpdate(operation)
                throw cancellation
            } catch (_: Exception) {
                if (finishSwapUpdate(operation)) {
                    emitMessage(R.string.feedback_shift_swap_update_failed)
                }
                return@launch
            }
            if (activeSwapUpdate != operation) return@launch
            activeSwapUpdate = null
            val didAcknowledge =
                updateIfCurrent(context) {
                    it.copy(
                        acknowledgedShiftSwapRequestIds = it.acknowledgedShiftSwapRequestIds + requestId,
                        isUpdatingShiftSwapRequest = false,
                    )
                }
            if (didAcknowledge) {
                acknowledgedSwapTransitions[requestId] = PendingAcknowledgedSwapTransition(
                    context = context,
                    effect = acknowledgedEffect,
                )
                refreshShifts()
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
        val candidate = request.candidates.firstOrNull {
            it.userId == mode.member.id && it.shiftId == candidateShiftId
        } ?: return
        updateShiftSwapRequest(
            requestId = requestId,
            acknowledgedEffect = AcknowledgedSwapEffect.Responded(
                userId = mode.member.id,
                candidateShiftId = candidate.shiftId,
                status = responseStatus,
            ),
        ) { currentRequest ->
            shiftSwapRequestRepository.respondToShiftSwapRequest(
                requestId = currentRequest.id,
                candidateShiftId = candidate.shiftId,
                response = responseStatus,
            )
        }
    }

    private fun reflectedAcknowledgementIds(
        context: ShiftSessionContext,
        acknowledgedRequestIds: Set<String>,
        requests: List<ShiftSwapRequest>,
    ): Set<String> = acknowledgedRequestIds.filterTo(mutableSetOf()) { requestId ->
        val pending = acknowledgedSwapTransitions[requestId]
        pending?.context == context && pending.effect.isReflectedIn(requests, requestId)
    }

    private fun reflectedShiftSwapCreateAcknowledgementIds(
        context: ShiftSessionContext,
        acknowledgedCreates: Map<String, String>,
        requests: List<ShiftSwapRequest>,
    ): Set<String> = acknowledgedCreates.mapNotNullTo(mutableSetOf()) { (requestId, shiftId) ->
        requestId.takeIf {
            requests.any { request ->
                request.id == requestId &&
                    request.requestedShiftId == shiftId &&
                    request.requesterUserId == context.memberId
            }
        }
    }

    private fun pruneAcknowledgedSwapTransitions(
        context: ShiftSessionContext,
        acknowledgedRequestIds: Set<String>,
    ) {
        acknowledgedSwapTransitions.entries.removeAll { (requestId, pending) ->
            requestId !in acknowledgedRequestIds || pending.context != context
        }
    }

    private fun nextOperation(context: ShiftSessionContext): ShiftOperation =
        ShiftOperation(context = context, token = ++nextOperationToken)

    private fun finishShiftRefresh(operation: ShiftOperation): Boolean {
        if (activeShiftRefresh != operation) return false
        activeShiftRefresh = null
        return updateIfCurrent(operation.context) { it.copy(isLoadingShifts = false) }
    }

    private fun finishCalendarRefresh(operation: ShiftOperation): Boolean {
        if (activeCalendarRefresh != operation) return false
        activeCalendarRefresh = null
        return updateIfCurrent(operation.context) { it.copy(isLoadingDeliveryCalendar = false) }
    }

    private fun finishCalendarMutation(operation: ShiftOperation): Boolean {
        if (activeCalendarMutation != operation) return false
        activeCalendarMutation = null
        return updateIfCurrent(operation.context) { it.copy(isSavingDeliveryCalendar = false) }
    }

    private fun finishPlanningMutation(operation: ShiftOperation): Boolean {
        if (activePlanningMutation != operation) return false
        activePlanningMutation = null
        return updateIfCurrent(operation.context) { it.copy(isSubmittingShiftPlanningRequest = false) }
    }

    private fun finishSwapCreate(operation: ShiftOperation): Boolean {
        if (activeSwapCreate != operation) return false
        activeSwapCreate = null
        return updateIfCurrent(operation.context) { it.copy(isSavingShiftSwapRequest = false) }
    }

    private fun finishSwapUpdate(operation: ShiftOperation): Boolean {
        if (activeSwapUpdate != operation) return false
        activeSwapUpdate = null
        return updateIfCurrent(operation.context) { it.copy(isUpdatingShiftSwapRequest = false) }
    }

    private fun updateIfCurrent(
        context: ShiftSessionContext,
        transform: (SessionUiState) -> SessionUiState,
    ): Boolean {
        if (!isCurrent(context)) return false
        var didUpdate = false
        uiState.update { state ->
            if (isCurrent(context, state)) {
                didUpdate = true
                transform(state)
            } else {
                state
            }
        }
        return didUpdate
    }

    private fun isCurrent(
        context: ShiftSessionContext,
        state: SessionUiState = uiState.value,
    ): Boolean {
        val mode = state.mode as? SessionMode.Authorized ?: return false
        return state.sessionEpoch == context.epoch &&
            state.sessionEnvironment == context.environment &&
            mode.principal.uid == context.principalUid &&
            mode.member.id == context.memberId
    }
}

private data class ShiftSessionContext(
    val epoch: Long,
    val environment: String?,
    val principalUid: String,
    val memberId: String,
) {
    companion object {
        fun from(state: SessionUiState, mode: SessionMode.Authorized) = ShiftSessionContext(
            epoch = state.sessionEpoch,
            environment = state.sessionEnvironment,
            principalUid = mode.principal.uid,
            memberId = mode.member.id,
        )
    }
}

private data class ShiftOperation(
    val context: ShiftSessionContext,
    val token: Long,
)

private data class PendingPlanningRequest(
    val context: ShiftSessionContext,
    val type: ShiftPlanningRequestType,
    val requestId: String,
    val requestedAtMillis: Long,
)

private data class PendingAcknowledgedSwapTransition(
    val context: ShiftSessionContext,
    val effect: AcknowledgedSwapEffect,
)

private sealed interface AcknowledgedSwapEffect {
    fun isReflectedIn(requests: List<ShiftSwapRequest>, requestId: String): Boolean

    data object Cancelled : AcknowledgedSwapEffect {
        override fun isReflectedIn(requests: List<ShiftSwapRequest>, requestId: String): Boolean =
            requests.any { request ->
                request.id == requestId && request.status == ShiftSwapRequestStatus.CANCELLED
            }
    }

    data class Applied(val candidateShiftId: String) : AcknowledgedSwapEffect {
        override fun isReflectedIn(requests: List<ShiftSwapRequest>, requestId: String): Boolean =
            requests.any { request ->
                request.id == requestId &&
                    request.status == ShiftSwapRequestStatus.APPLIED &&
                    request.selectedCandidateShiftId == candidateShiftId
            }
    }

    data class Responded(
        val userId: String,
        val candidateShiftId: String,
        val status: ShiftSwapResponseStatus,
    ) : AcknowledgedSwapEffect {
        override fun isReflectedIn(requests: List<ShiftSwapRequest>, requestId: String): Boolean =
            requests.firstOrNull { request -> request.id == requestId }
                ?.responses
                ?.any { response ->
                    response.userId == userId &&
                        response.shiftId == candidateShiftId &&
                        response.status == status
                } == true
    }
}

internal fun shouldDeleteDeliveryCalendarOverride(
    hasExistingOverride: Boolean,
    selectedWeekday: DeliveryWeekday,
    defaultWeekday: DeliveryWeekday?,
): Boolean = hasExistingOverride && selectedWeekday == defaultWeekday
