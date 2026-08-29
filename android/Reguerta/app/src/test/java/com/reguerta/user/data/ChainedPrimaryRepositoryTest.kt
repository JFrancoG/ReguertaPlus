package com.reguerta.user.data

import com.reguerta.user.data.calendar.ChainedDeliveryCalendarRepository
import com.reguerta.user.data.shiftplanning.ChainedShiftPlanningRequestRepository
import com.reguerta.user.data.shifts.ChainedShiftRepository
import com.reguerta.user.domain.calendar.DeliveryCalendarOverride
import com.reguerta.user.domain.calendar.DeliveryCalendarRepository
import com.reguerta.user.domain.calendar.DeliveryWeekday
import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.domain.shifts.ShiftPlanningRequest
import com.reguerta.user.domain.shifts.ShiftPlanningRequestRepository
import com.reguerta.user.domain.shifts.ShiftPlanningRequestStatus
import com.reguerta.user.domain.shifts.ShiftPlanningRequestType
import com.reguerta.user.domain.shifts.ShiftRepository
import com.reguerta.user.domain.shifts.ShiftStatus
import com.reguerta.user.domain.shifts.ShiftType
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Test

class ChainedPrimaryRepositoryTest {
    @Test
    fun `empty primary shift snapshot is legitimate and does not consult fallback`() = runBlocking {
        val primary = RecordingShiftRepository(shifts = emptyList())
        val fallback = RecordingShiftRepository(shifts = listOf(shift()))
        val repository = ChainedShiftRepository(primary, fallback)

        assertEquals(emptyList<ShiftAssignment>(), repository.getAllShifts())
        assertEquals(1, primary.readCalls)
        assertEquals(0, fallback.readCalls)
    }

    @Test
    fun `shift read failures propagate without fallback`() = runBlocking {
        val readFailure = IllegalStateException("read")
        val fallback = RecordingShiftRepository(shifts = listOf(shift()))
        val repository = ChainedShiftRepository(
            primary = RecordingShiftRepository(
                shifts = emptyList(),
                readFailure = readFailure,
            ),
            fallback = fallback,
        )

        assertSameFailure(readFailure) { repository.getAllShifts() }
        assertEquals(0, fallback.readCalls)
    }

    @Test
    fun `empty primary calendar values are legitimate and do not consult fallback`() = runBlocking {
        val primary = RecordingCalendarRepository(defaultWeekday = null, overrides = emptyList())
        val fallback = RecordingCalendarRepository(
            defaultWeekday = DeliveryWeekday.WEDNESDAY,
            overrides = listOf(calendarOverride()),
        )
        val repository = ChainedDeliveryCalendarRepository(primary, fallback)

        assertNull(repository.getDefaultDeliveryDayOfWeek())
        assertEquals(emptyList<DeliveryCalendarOverride>(), repository.getAllOverrides())
        assertEquals(0, fallback.defaultReadCalls)
        assertEquals(0, fallback.overrideReadCalls)
    }

    @Test
    fun `calendar writes affect primary only`() = runBlocking {
        val primary = RecordingCalendarRepository()
        val fallback = RecordingCalendarRepository()
        val repository = ChainedDeliveryCalendarRepository(primary, fallback)
        val override = calendarOverride()

        assertEquals(override, repository.upsertOverride(override))
        repository.deleteOverride(override.weekKey)

        assertEquals(1, primary.upsertCalls)
        assertEquals(1, primary.deleteCalls)
        assertEquals(0, fallback.upsertCalls)
        assertEquals(0, fallback.deleteCalls)
    }

    @Test
    fun `calendar read and write failures propagate without fallback`() = runBlocking {
        val readFailure = IllegalStateException("read")
        val writeFailure = IllegalStateException("write")
        val fallback = RecordingCalendarRepository()
        val repository = ChainedDeliveryCalendarRepository(
            primary = RecordingCalendarRepository(
                overrideReadFailure = readFailure,
                writeFailure = writeFailure,
            ),
            fallback = fallback,
        )

        assertSameFailure(readFailure) { repository.getAllOverrides() }
        assertSameFailure(writeFailure) { repository.upsertOverride(calendarOverride()) }
        assertEquals(0, fallback.overrideReadCalls)
        assertEquals(0, fallback.upsertCalls)
    }

    @Test
    fun `planning submit returns primary result and never invokes fallback`() = runBlocking {
        val request = planningRequest()
        val primaryResult = request.copy(status = ShiftPlanningRequestStatus.COMPLETED)
        val primary = RecordingPlanningRepository(result = primaryResult)
        val fallback = RecordingPlanningRepository(result = request)
        val repository = ChainedShiftPlanningRequestRepository(primary, fallback)

        assertEquals(primaryResult, repository.submitShiftPlanningRequest(request))
        assertEquals(1, primary.calls)
        assertEquals(0, fallback.calls)
    }

    @Test
    fun `planning submit failure propagates without fallback success`() = runBlocking {
        val failure = IllegalStateException("write")
        val fallback = RecordingPlanningRepository(result = planningRequest())
        val repository = ChainedShiftPlanningRequestRepository(
            primary = RecordingPlanningRepository(result = planningRequest(), failure = failure),
            fallback = fallback,
        )

        assertSameFailure(failure) { repository.submitShiftPlanningRequest(planningRequest()) }
        assertEquals(0, fallback.calls)
    }

    private suspend fun assertSameFailure(expected: Throwable, block: suspend () -> Unit) {
        var captured: Throwable? = null
        try {
            block()
        } catch (error: Throwable) {
            captured = error
        }
        assertSame(expected, captured)
    }

    private fun shift() = ShiftAssignment(
        id = "shift-1",
        type = ShiftType.DELIVERY,
        dateMillis = 1_000L,
        assignedUserIds = listOf("member-1"),
        helperUserId = null,
        status = ShiftStatus.PLANNED,
        source = "app",
        createdAtMillis = 1_000L,
        updatedAtMillis = 1_000L,
    )

    private fun calendarOverride() = DeliveryCalendarOverride(
        weekKey = "2026-W31",
        deliveryDateMillis = 1_000L,
        ordersBlockedDateMillis = 2_000L,
        ordersOpenAtMillis = 3_000L,
        ordersCloseAtMillis = 4_000L,
        updatedBy = "member-1",
        updatedAtMillis = 5_000L,
    )

    private fun planningRequest() = ShiftPlanningRequest(
        id = "planning-1",
        type = ShiftPlanningRequestType.DELIVERY,
        requestedByUserId = "member-1",
        requestedAtMillis = 1_000L,
        status = ShiftPlanningRequestStatus.REQUESTED,
    )
}

private class RecordingShiftRepository(
    private val shifts: List<ShiftAssignment>,
    private val readFailure: Throwable? = null,
) : ShiftRepository {
    var readCalls = 0

    override suspend fun getAllShifts(): List<ShiftAssignment> {
        readCalls += 1
        readFailure?.let { throw it }
        return shifts
    }
}

private class RecordingCalendarRepository(
    private val defaultWeekday: DeliveryWeekday? = null,
    private val overrides: List<DeliveryCalendarOverride> = emptyList(),
    private val overrideReadFailure: Throwable? = null,
    private val writeFailure: Throwable? = null,
) : DeliveryCalendarRepository {
    var defaultReadCalls = 0
    var overrideReadCalls = 0
    var upsertCalls = 0
    var deleteCalls = 0

    override suspend fun getDefaultDeliveryDayOfWeek(): DeliveryWeekday? {
        defaultReadCalls += 1
        return defaultWeekday
    }

    override suspend fun getAllOverrides(): List<DeliveryCalendarOverride> {
        overrideReadCalls += 1
        overrideReadFailure?.let { throw it }
        return overrides
    }

    override suspend fun upsertOverride(override: DeliveryCalendarOverride): DeliveryCalendarOverride {
        upsertCalls += 1
        writeFailure?.let { throw it }
        return override
    }

    override suspend fun deleteOverride(weekKey: String) {
        deleteCalls += 1
        writeFailure?.let { throw it }
    }
}

private class RecordingPlanningRepository(
    private val result: ShiftPlanningRequest,
    private val failure: Throwable? = null,
) : ShiftPlanningRequestRepository {
    var calls = 0

    override suspend fun submitShiftPlanningRequest(request: ShiftPlanningRequest): ShiftPlanningRequest {
        calls += 1
        failure?.let { throw it }
        return result
    }
}
