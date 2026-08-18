package com.reguerta.user.presentation.shifts

import com.reguerta.user.R
import com.reguerta.user.domain.access.AuthPrincipal
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.calendar.DeliveryCalendarOverride
import com.reguerta.user.domain.calendar.DeliveryCalendarRepository
import com.reguerta.user.domain.calendar.DeliveryWeekday
import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.domain.shifts.ShiftPlanningRequest
import com.reguerta.user.domain.shifts.ShiftPlanningRequestRepository
import com.reguerta.user.domain.shifts.ShiftRepository
import com.reguerta.user.domain.shifts.ShiftStatus
import com.reguerta.user.domain.shifts.ShiftSwapRequest
import com.reguerta.user.domain.shifts.ShiftSwapRequestRepository
import com.reguerta.user.domain.shifts.ShiftSwapRequestStatus
import com.reguerta.user.domain.shifts.ShiftSwapResponseStatus
import com.reguerta.user.domain.shifts.ShiftType
import com.reguerta.user.presentation.auth.toSignedOutSessionState
import com.reguerta.user.presentation.auth.reconcileAuthorizedShiftState
import com.reguerta.user.presentation.auth.resolveAuthorizedSessionAccessTransition
import com.reguerta.user.presentation.root.SessionMode
import com.reguerta.user.presentation.root.SessionUiState
import com.reguerta.user.presentation.root.ShiftSwapDraft
import java.io.IOException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class SessionShiftActionsFailureTest {
    @Test
    fun `first shift failure retries automatically before showing feedback`() = runTest {
        val recovered = shift("recovered")
        val repository = QueuedShiftRepository(
            ArrayDeque(
                listOf(
                    Result.failure(IOException("temporary")),
                    Result.success(listOf(recovered)),
                ),
            ),
        )
        val state = MutableStateFlow(authorizedState())
        val messages = mutableListOf<Int>()
        val actions = actions(
            state = state,
            shiftRepository = repository,
            emitMessage = messages::add,
            automaticLoadRetryDelayMillis = 10_000L,
        )

        actions.refreshShifts()
        runCurrent()
        assertEquals(emptyList<Int>(), messages)

        advanceTimeBy(10_000L)
        advanceUntilIdle()

        assertEquals(listOf(recovered), state.value.shiftsFeed)
        assertEquals(emptyList<Int>(), messages)
    }

    @Test
    fun `failed shift refresh preserves the last snapshot and reports load failure`() = runTest {
        val previous = shift("previous")
        val state = MutableStateFlow(authorizedState().copy(shiftsFeed = listOf(previous)))
        val messages = mutableListOf<Int>()
        val actions = actions(
            state = state,
            shiftRepository = RejectingShiftRepository,
            emitMessage = messages::add,
        )

        actions.refreshShifts()
        advanceUntilIdle()

        assertEquals(listOf(previous), state.value.shiftsFeed)
        assertFalse(state.value.isLoadingShifts)
        assertEquals(listOf(R.string.feedback_unable_load_data), messages)
    }

    @Test
    fun `stale shift refresh from a revoked session publishes nothing`() = runTest {
        val previous = shift("previous")
        val repository = SuspendedShiftRepository(listOf(shift("new")))
        val state = MutableStateFlow(authorizedState().copy(shiftsFeed = listOf(previous)))
        val messages = mutableListOf<Int>()
        val actions = actions(
            state = state,
            shiftRepository = repository,
            emitMessage = messages::add,
        )

        actions.refreshShifts()
        runCurrent()
        repository.awaitReadStarted()
        state.value = state.value.toSignedOutSessionState(showSessionExpiredDialog = false)
        repository.completeRead()
        advanceUntilIdle()

        assertTrue(state.value.mode is SessionMode.SignedOut)
        assertEquals(emptyList<ShiftAssignment>(), state.value.shiftsFeed)
        assertEquals(emptyList<Int>(), messages)
    }

    @Test
    fun `confirmed swap create clears submitted draft even when secondary refresh fails`() = runTest {
        val requestedShift = shift("requested", memberId = "admin")
        val candidateShift = shift("candidate", memberId = "member-2", dateMillis = 2_000_000_000L)
        val draft = ShiftSwapDraft(shiftId = requestedShift.id, reason = "Cambio")
        val state = MutableStateFlow(
            authorizedState().copy(
                shiftsFeed = listOf(requestedShift, candidateShift),
                shiftSwapDraft = draft,
            ),
        )
        val messages = mutableListOf<Int>()
        var didSucceed = false
        val swapRepository = ConfirmingCreateThenRejectingReadSwapRepository()
        val actions = actions(
            state = state,
            shiftRepository = RejectingShiftRepository,
            swapRepository = swapRepository,
            emitMessage = messages::add,
        )

        actions.saveShiftSwapRequest { didSucceed = true }
        advanceUntilIdle()

        assertTrue(didSucceed)
        assertEquals(ShiftSwapDraft(), state.value.shiftSwapDraft)
        assertEquals(mapOf("request" to requestedShift.id), state.value.acknowledgedShiftSwapCreates)
        assertFalse(state.value.isSavingShiftSwapRequest)
        assertEquals(listOf(requestedShift, candidateShift), state.value.shiftsFeed)
        assertEquals(R.string.feedback_unable_load_data, messages.last())

        state.value = state.value.copy(shiftSwapDraft = draft)
        actions.saveShiftSwapRequest()
        advanceUntilIdle()

        assertEquals(1, swapRepository.createCalls)
    }

    @Test
    fun `remote create readback reconciles projection and still blocks duplicate open request`() = runTest {
        val requestedShift = shift("shift", memberId = "admin")
        val candidateShift = shift("candidate", memberId = "member-2", dateMillis = 2_000_000_000L)
        val remoteRequest = swapRequest()
        val draft = ShiftSwapDraft(shiftId = requestedShift.id, reason = "Cambio")
        val swapRepository = ConfirmingCreateThenReadingSwapRepository(remoteRequest)
        val state = MutableStateFlow(
            authorizedState().copy(
                shiftsFeed = listOf(requestedShift, candidateShift),
                shiftSwapDraft = draft,
            ),
        )
        val actions = actions(
            state = state,
            shiftRepository = StaticShiftRepository(listOf(requestedShift, candidateShift)),
            swapRepository = swapRepository,
        )

        actions.saveShiftSwapRequest()
        advanceUntilIdle()

        assertEquals(emptyMap<String, String>(), state.value.acknowledgedShiftSwapCreates)
        assertEquals(listOf(remoteRequest), state.value.shiftSwapRequests)

        state.value = state.value.copy(shiftSwapDraft = draft)
        actions.saveShiftSwapRequest()
        advanceUntilIdle()

        assertEquals(1, swapRepository.createCalls)
        assertEquals(listOf(remoteRequest), state.value.shiftSwapRequests)
    }

    @Test
    fun `confirmed calendar write applies locally before a failed secondary refresh`() = runTest {
        val existing = calendarOverride("2026-W30", DeliveryWeekday.WEDNESDAY)
        val state = MutableStateFlow(
            authorizedState().copy(
                defaultDeliveryDayOfWeek = DeliveryWeekday.WEDNESDAY,
                deliveryCalendarOverrides = listOf(existing),
            ),
        )
        val messages = mutableListOf<Int>()
        var didSucceed = false
        val repository = ConfirmingThenRejectingReadCalendarRepository()
        val actions = actions(
            state = state,
            calendarRepository = repository,
            emitMessage = messages::add,
        )

        actions.saveDeliveryCalendarOverride(
            weekKey = "2026-W31",
            weekday = DeliveryWeekday.FRIDAY,
            updatedByUserId = "admin",
        ) { didSucceed = true }
        advanceUntilIdle()

        assertTrue(didSucceed)
        assertEquals(listOf("2026-W30", "2026-W31"), state.value.deliveryCalendarOverrides.map { it.weekKey })
        assertFalse(state.value.isSavingDeliveryCalendar)
        assertEquals(R.string.feedback_unable_load_data, messages.last())
    }

    @Test
    fun `rejected calendar write preserves snapshot and leaves the editor callback pending`() = runTest {
        val existing = calendarOverride("2026-W30", DeliveryWeekday.WEDNESDAY)
        val state = MutableStateFlow(
            authorizedState().copy(
                defaultDeliveryDayOfWeek = DeliveryWeekday.WEDNESDAY,
                deliveryCalendarOverrides = listOf(existing),
            ),
        )
        val messages = mutableListOf<Int>()
        var didSucceed = false
        val actions = actions(
            state = state,
            calendarRepository = RejectingCalendarWriteRepository,
            emitMessage = messages::add,
        )

        actions.saveDeliveryCalendarOverride(
            weekKey = "2026-W31",
            weekday = DeliveryWeekday.FRIDAY,
            updatedByUserId = "admin",
        ) { didSucceed = true }
        advanceUntilIdle()

        assertFalse(didSucceed)
        assertEquals(listOf(existing), state.value.deliveryCalendarOverrides)
        assertFalse(state.value.isSavingDeliveryCalendar)
        assertEquals(R.string.feedback_unable_save_changes, messages.last())
    }

    @Test
    fun `planning retry reuses a non blank request id`() = runTest {
        val repository = AmbiguousFirstPlanningRepository()
        val state = MutableStateFlow(authorizedState())
        val actions = actions(state = state, planningRepository = repository, emitMessage = {})

        actions.submitShiftPlanningRequest(com.reguerta.user.domain.shifts.ShiftPlanningRequestType.MARKET)
        advanceUntilIdle()
        actions.submitShiftPlanningRequest(com.reguerta.user.domain.shifts.ShiftPlanningRequestType.MARKET)
        advanceUntilIdle()

        assertEquals(2, repository.ids.size)
        assertNotEquals("", repository.ids.first())
        assertEquals(1, repository.ids.distinct().size)
        assertFalse(state.value.isSubmittingShiftPlanningRequest)
    }

    @Test
    fun `cancelled swap mutation clears loading without feedback or draft loss`() = runTest {
        val requestedShift = shift("requested", memberId = "admin")
        val candidateShift = shift("candidate", memberId = "member-2", dateMillis = 2_000_000_000L)
        val draft = ShiftSwapDraft(shiftId = requestedShift.id, reason = "Cambio")
        val state = MutableStateFlow(
            authorizedState().copy(shiftsFeed = listOf(requestedShift, candidateShift), shiftSwapDraft = draft),
        )
        val messages = mutableListOf<Int>()
        val actions = actions(
            state = state,
            swapRepository = CancellingSwapRepository,
            emitMessage = messages::add,
        )

        actions.saveShiftSwapRequest()
        advanceUntilIdle()

        assertEquals(draft, state.value.shiftSwapDraft)
        assertFalse(state.value.isSavingShiftSwapRequest)
        assertEquals(emptyList<Int>(), messages)
    }

    @Test
    fun `confirmed swap update preserves snapshot when secondary refresh fails`() = runTest {
        val request = swapRequest()
        val previousShift = shift("shift")
        val swapRepository = ConfirmingTransitionThenRejectingReadSwapRepository()
        val state = MutableStateFlow(
            authorizedState().copy(
                shiftsFeed = listOf(previousShift),
                shiftSwapRequests = listOf(request),
            ),
        )
        val messages = mutableListOf<Int>()
        val actions = actions(
            state = state,
            shiftRepository = StaticShiftRepository(listOf(shift("new"))),
            swapRepository = swapRepository,
            emitMessage = messages::add,
        )

        actions.cancelShiftSwapRequest(request.id)
        advanceUntilIdle()
        actions.cancelShiftSwapRequest(request.id)
        advanceUntilIdle()

        assertEquals(listOf(previousShift), state.value.shiftsFeed)
        assertEquals(listOf(request), state.value.shiftSwapRequests)
        assertEquals(setOf(request.id), state.value.acknowledgedShiftSwapRequestIds)
        assertEquals(1, swapRepository.cancelCalls)
        assertFalse(state.value.isUpdatingShiftSwapRequest)
        assertEquals(R.string.feedback_unable_load_data, messages.last())
    }

    @Test
    fun `successful swap readback clears acknowledged transition suppression`() = runTest {
        val request = swapRequest()
        val cancelledRequest = request.copy(status = ShiftSwapRequestStatus.CANCELLED)
        val state = MutableStateFlow(
            authorizedState().copy(shiftSwapRequests = listOf(request)),
        )
        val actions = actions(
            state = state,
            swapRepository = ConfirmingCancelThenReadingSwapRepository(cancelledRequest),
        )

        actions.cancelShiftSwapRequest(request.id)
        advanceUntilIdle()

        assertEquals(emptySet<String>(), state.value.acknowledgedShiftSwapRequestIds)
        assertEquals(listOf(cancelledRequest), state.value.shiftSwapRequests)
    }

    @Test
    fun `successful but stale swap readback keeps acknowledged transition suppressed`() = runTest {
        val request = swapRequest()
        val swapRepository = ConfirmingCancelThenReadingSwapRepository(request)
        val state = MutableStateFlow(
            authorizedState().copy(shiftSwapRequests = listOf(request)),
        )
        val actions = actions(state = state, swapRepository = swapRepository)

        actions.cancelShiftSwapRequest(request.id)
        advanceUntilIdle()
        actions.cancelShiftSwapRequest(request.id)
        advanceUntilIdle()

        assertEquals(setOf(request.id), state.value.acknowledgedShiftSwapRequestIds)
        assertEquals(listOf(request), state.value.shiftSwapRequests)
        assertEquals(1, swapRepository.cancelCalls)
    }

    @Test
    fun `session revocation clears all shift calendar and swap state`() {
        val state = authorizedState().copy(
            shiftsFeed = listOf(shift("shift")),
            deliveryCalendarOverrides = listOf(calendarOverride("2026-W31", DeliveryWeekday.FRIDAY)),
            defaultDeliveryDayOfWeek = DeliveryWeekday.WEDNESDAY,
            shiftSwapRequests = listOf(swapRequest()),
            dismissedShiftSwapRequestIds = setOf("request"),
            acknowledgedShiftSwapRequestIds = setOf("request"),
            acknowledgedShiftSwapCreates = mapOf("request" to "shift"),
            shiftSwapDraft = ShiftSwapDraft("shift", "reason"),
            isLoadingShifts = true,
            isLoadingDeliveryCalendar = true,
            isSavingDeliveryCalendar = true,
            isSubmittingShiftPlanningRequest = true,
            isSavingShiftSwapRequest = true,
            isUpdatingShiftSwapRequest = true,
        ).toSignedOutSessionState(showSessionExpiredDialog = false)

        assertEquals(emptyList<ShiftAssignment>(), state.shiftsFeed)
        assertEquals(emptyList<DeliveryCalendarOverride>(), state.deliveryCalendarOverrides)
        assertEquals(null, state.defaultDeliveryDayOfWeek)
        assertEquals(emptyList<ShiftSwapRequest>(), state.shiftSwapRequests)
        assertEquals(emptySet<String>(), state.dismissedShiftSwapRequestIds)
        assertEquals(emptySet<String>(), state.acknowledgedShiftSwapRequestIds)
        assertEquals(emptyMap<String, String>(), state.acknowledgedShiftSwapCreates)
        assertEquals(ShiftSwapDraft(), state.shiftSwapDraft)
        assertFalse(state.isLoadingShifts)
        assertFalse(state.isLoadingDeliveryCalendar)
        assertFalse(state.isSavingDeliveryCalendar)
        assertFalse(state.isSubmittingShiftPlanningRequest)
        assertFalse(state.isSavingShiftSwapRequest)
        assertFalse(state.isUpdatingShiftSwapRequest)
    }

    @Test
    fun `admin revocation invalidates session context and clears admin shift state`() {
        val initialState = authorizedState().copy(
            sessionEpoch = 7L,
            shiftsFeed = listOf(shift("shift")),
            deliveryCalendarOverrides = listOf(calendarOverride("2026-W31", DeliveryWeekday.FRIDAY)),
            defaultDeliveryDayOfWeek = DeliveryWeekday.WEDNESDAY,
            isLoadingDeliveryCalendar = true,
            isSavingDeliveryCalendar = true,
            isSubmittingShiftPlanningRequest = true,
        )
        val currentMode = initialState.mode as SessionMode.Authorized
        val nonAdminMember = currentMode.member.copy(roles = setOf(MemberRole.MEMBER))
        val transition = resolveAuthorizedSessionAccessTransition(
            currentMode = currentMode,
            currentEnvironment = "develop",
            principal = currentMode.principal,
            member = nonAdminMember,
            resolvedEnvironment = "develop",
        )

        val reconciled = initialState.reconcileAuthorizedShiftState(transition)

        assertEquals(8L, reconciled.sessionEpoch)
        assertEquals(initialState.shiftsFeed, reconciled.shiftsFeed)
        assertEquals(emptyList<DeliveryCalendarOverride>(), reconciled.deliveryCalendarOverrides)
        assertEquals(null, reconciled.defaultDeliveryDayOfWeek)
        assertFalse(reconciled.isLoadingDeliveryCalendar)
        assertFalse(reconciled.isSavingDeliveryCalendar)
        assertFalse(reconciled.isSubmittingShiftPlanningRequest)
    }

    @Test
    fun `environment switch fences an in flight shift read from the previous path`() = runTest {
        val previousShift = shift("previous")
        val staleRepository = SuspendedShiftRepository(listOf(shift("stale")))
        val state = MutableStateFlow(
            authorizedState().copy(
                sessionEnvironment = "develop",
                shiftsFeed = listOf(previousShift),
                deliveryCalendarOverrides = listOf(calendarOverride("2026-W31", DeliveryWeekday.FRIDAY)),
                defaultDeliveryDayOfWeek = DeliveryWeekday.WEDNESDAY,
                shiftSwapRequests = listOf(swapRequest()),
                dismissedShiftSwapRequestIds = setOf("request"),
                shiftSwapDraft = ShiftSwapDraft("shift", "reason"),
                nextDeliveryShift = previousShift,
            ),
        )
        val actions = actions(state = state, shiftRepository = staleRepository)

        actions.refreshShifts()
        staleRepository.awaitReadStarted()
        val currentMode = state.value.mode as SessionMode.Authorized
        val transition = resolveAuthorizedSessionAccessTransition(
            currentMode = currentMode,
            currentEnvironment = state.value.sessionEnvironment,
            principal = currentMode.principal,
            member = currentMode.member,
            resolvedEnvironment = "production",
        )
        state.value = state.value.reconcileAuthorizedShiftState(transition).copy(
            sessionEnvironment = "production",
        )
        staleRepository.completeRead()
        advanceUntilIdle()

        assertEquals(1L, state.value.sessionEpoch)
        assertEquals("production", state.value.sessionEnvironment)
        assertEquals(emptyList<ShiftAssignment>(), state.value.shiftsFeed)
        assertEquals(emptyList<DeliveryCalendarOverride>(), state.value.deliveryCalendarOverrides)
        assertEquals(null, state.value.defaultDeliveryDayOfWeek)
        assertEquals(emptyList<ShiftSwapRequest>(), state.value.shiftSwapRequests)
        assertEquals(emptySet<String>(), state.value.dismissedShiftSwapRequestIds)
        assertEquals(ShiftSwapDraft(), state.value.shiftSwapDraft)
        assertEquals(null, state.value.nextDeliveryShift)
        assertFalse(state.value.isLoadingShifts)
    }

    private suspend fun actions(
        state: MutableStateFlow<SessionUiState>,
        shiftRepository: ShiftRepository = StaticShiftRepository(emptyList()),
        calendarRepository: DeliveryCalendarRepository = StaticCalendarRepository,
        planningRepository: ShiftPlanningRequestRepository = ConfirmingPlanningRepository,
        swapRepository: ShiftSwapRequestRepository = StaticSwapRepository,
        emitMessage: (Int) -> Unit = {},
        automaticLoadRetryDelayMillis: Long? = null,
    ) = SessionShiftActions(
        uiState = state,
        scope = CoroutineScope(kotlinx.coroutines.currentCoroutineContext()),
        shiftRepository = shiftRepository,
        deliveryCalendarRepository = calendarRepository,
        shiftPlanningRequestRepository = planningRepository,
        shiftSwapRequestRepository = swapRepository,
        nowMillisProvider = { 100L },
        emitMessage = emitMessage,
        automaticLoadRetryDelayMillis = automaticLoadRetryDelayMillis,
    )

    private fun authorizedState(): SessionUiState {
        val admin = Member(
            id = "admin",
            displayName = "Admin",
            normalizedEmail = "admin@reguerta.test",
            authUid = "auth-admin",
            roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN),
            isActive = true,
            producerCatalogEnabled = false,
        )
        return SessionUiState(
            mode = SessionMode.Authorized(
                principal = AuthPrincipal(uid = "auth-admin", email = admin.normalizedEmail),
                authenticatedMember = admin,
                member = admin,
                members = listOf(admin),
            ),
        )
    }

    private fun shift(id: String, memberId: String = "admin", dateMillis: Long = 1_000L) = ShiftAssignment(
        id = id,
        type = ShiftType.DELIVERY,
        dateMillis = dateMillis,
        assignedUserIds = listOf(memberId),
        helperUserId = null,
        status = ShiftStatus.PLANNED,
        source = "test",
        createdAtMillis = 1L,
        updatedAtMillis = 1L,
    )

    private fun calendarOverride(weekKey: String, weekday: DeliveryWeekday): DeliveryCalendarOverride {
        val dayOffset = weekday.ordinal * 24L * 60L * 60L * 1_000L
        return DeliveryCalendarOverride(
            weekKey = weekKey,
            deliveryDateMillis = dayOffset,
            ordersBlockedDateMillis = dayOffset + 1L,
            ordersOpenAtMillis = dayOffset + 2L,
            ordersCloseAtMillis = dayOffset + 3L,
            updatedBy = "admin",
            updatedAtMillis = 1L,
        )
    }

    private fun swapRequest() = ShiftSwapRequest(
        id = "request",
        requestedShiftId = "shift",
        requesterUserId = "admin",
        reason = "reason",
        status = com.reguerta.user.domain.shifts.ShiftSwapRequestStatus.OPEN,
        candidates = emptyList(),
        responses = emptyList(),
        selectedCandidateUserId = null,
        selectedCandidateShiftId = null,
        requestedAtMillis = 1L,
        confirmedAtMillis = null,
        appliedAtMillis = null,
    )
}

private class StaticShiftRepository(private val shifts: List<ShiftAssignment>) : ShiftRepository {
    override suspend fun getAllShifts(): List<ShiftAssignment> = shifts
    override suspend fun upsertShift(shift: ShiftAssignment): ShiftAssignment = shift
}

private object RejectingShiftRepository : ShiftRepository {
    override suspend fun getAllShifts(): List<ShiftAssignment> = throw IOException("read failed")
    override suspend fun upsertShift(shift: ShiftAssignment): ShiftAssignment = shift
}

private class QueuedShiftRepository(
    private val readResults: ArrayDeque<Result<List<ShiftAssignment>>>,
) : ShiftRepository {
    override suspend fun getAllShifts(): List<ShiftAssignment> = readResults.removeFirst().getOrThrow()
    override suspend fun upsertShift(shift: ShiftAssignment): ShiftAssignment = shift
}

private class SuspendedShiftRepository(private val result: List<ShiftAssignment>) : ShiftRepository {
    private val started = CompletableDeferred<Unit>()
    private val release = CompletableDeferred<Unit>()

    override suspend fun getAllShifts(): List<ShiftAssignment> {
        started.complete(Unit)
        release.await()
        return result
    }

    override suspend fun upsertShift(shift: ShiftAssignment): ShiftAssignment = shift

    suspend fun awaitReadStarted() = started.await()

    fun completeRead() {
        release.complete(Unit)
    }
}

private object StaticSwapRepository : ShiftSwapRequestRepository {
    override suspend fun getAllShiftSwapRequests(): List<ShiftSwapRequest> = emptyList()
    override suspend fun createShiftSwapRequest(requestedShiftId: String, reason: String): String = "request"
    override suspend fun respondToShiftSwapRequest(requestId: String, candidateShiftId: String, response: ShiftSwapResponseStatus) = Unit
    override suspend fun cancelShiftSwapRequest(requestId: String) = Unit
    override suspend fun applyShiftSwapRequest(requestId: String, candidateShiftId: String) = Unit
}

private class ConfirmingCreateThenRejectingReadSwapRepository : ShiftSwapRequestRepository by StaticSwapRepository {
    var createCalls = 0

    override suspend fun createShiftSwapRequest(requestedShiftId: String, reason: String): String {
        createCalls += 1
        return "request"
    }

    override suspend fun getAllShiftSwapRequests(): List<ShiftSwapRequest> = throw IOException("read failed")
}

private class ConfirmingCreateThenReadingSwapRepository(
    private val request: ShiftSwapRequest,
) : ShiftSwapRequestRepository by StaticSwapRepository {
    var createCalls = 0

    override suspend fun createShiftSwapRequest(requestedShiftId: String, reason: String): String {
        createCalls += 1
        return request.id
    }

    override suspend fun getAllShiftSwapRequests(): List<ShiftSwapRequest> = listOf(request)
}

private object CancellingSwapRepository : ShiftSwapRequestRepository by StaticSwapRepository {
    override suspend fun createShiftSwapRequest(requestedShiftId: String, reason: String): String =
        throw CancellationException("cancelled")
}

private class ConfirmingTransitionThenRejectingReadSwapRepository : ShiftSwapRequestRepository by StaticSwapRepository {
    var cancelCalls = 0

    override suspend fun getAllShiftSwapRequests(): List<ShiftSwapRequest> = throw IOException("read failed")

    override suspend fun cancelShiftSwapRequest(requestId: String) {
        cancelCalls += 1
    }
}

private class ConfirmingCancelThenReadingSwapRepository(
    private val request: ShiftSwapRequest,
) : ShiftSwapRequestRepository by StaticSwapRepository {
    var cancelCalls = 0

    override suspend fun getAllShiftSwapRequests(): List<ShiftSwapRequest> = listOf(request)

    override suspend fun cancelShiftSwapRequest(requestId: String) {
        cancelCalls += 1
    }
}

private object StaticCalendarRepository : DeliveryCalendarRepository {
    override suspend fun getDefaultDeliveryDayOfWeek(): DeliveryWeekday? = DeliveryWeekday.WEDNESDAY
    override suspend fun getAllOverrides(): List<DeliveryCalendarOverride> = emptyList()
    override suspend fun upsertOverride(override: DeliveryCalendarOverride): DeliveryCalendarOverride = override
    override suspend fun deleteOverride(weekKey: String) = Unit
}

private class ConfirmingThenRejectingReadCalendarRepository : DeliveryCalendarRepository {
    override suspend fun getDefaultDeliveryDayOfWeek(): DeliveryWeekday? = throw IOException("read failed")
    override suspend fun getAllOverrides(): List<DeliveryCalendarOverride> = throw IOException("read failed")
    override suspend fun upsertOverride(override: DeliveryCalendarOverride): DeliveryCalendarOverride = override
    override suspend fun deleteOverride(weekKey: String) = Unit
}

private object RejectingCalendarWriteRepository : DeliveryCalendarRepository by StaticCalendarRepository {
    override suspend fun upsertOverride(override: DeliveryCalendarOverride): DeliveryCalendarOverride =
        throw IOException("write failed")

    override suspend fun deleteOverride(weekKey: String) = throw IOException("write failed")
}

private object ConfirmingPlanningRepository : ShiftPlanningRequestRepository {
    override suspend fun submitShiftPlanningRequest(request: ShiftPlanningRequest): ShiftPlanningRequest = request
}

private class AmbiguousFirstPlanningRepository : ShiftPlanningRequestRepository {
    val ids = mutableListOf<String>()

    override suspend fun submitShiftPlanningRequest(request: ShiftPlanningRequest): ShiftPlanningRequest {
        ids += request.id
        if (ids.size == 1) throw IOException("ambiguous")
        return request
    }
}
