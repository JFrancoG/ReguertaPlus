package com.reguerta.user.presentation.access

import com.reguerta.user.domain.calendar.DeliveryCalendarOverride
import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.domain.shifts.ShiftStatus
import com.reguerta.user.domain.shifts.ShiftSwapCandidate
import com.reguerta.user.domain.shifts.ShiftSwapRequest
import com.reguerta.user.domain.shifts.ShiftSwapRequestStatus
import com.reguerta.user.domain.shifts.ShiftSwapResponse
import com.reguerta.user.domain.shifts.ShiftSwapResponseStatus
import com.reguerta.user.domain.shifts.ShiftType
import java.time.LocalDate
import java.time.ZoneId
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ShiftPresentationHelpersTest {
    private val zone = ZoneId.of("Europe/Madrid")

    @Test
    fun nextShiftHelpersResolveDeliveryRolesAndMarketAssignment() {
        val memberId = "member_1"
        val shifts = listOf(
            deliveryShift(
                id = "past_lead",
                date = LocalDate.of(2026, 5, 1),
                assignedUserIds = listOf(memberId),
            ),
            deliveryShift(
                id = "next_lead",
                date = LocalDate.of(2026, 5, 8),
                assignedUserIds = listOf(memberId),
            ),
            deliveryShift(
                id = "next_helper",
                date = LocalDate.of(2026, 5, 15),
                assignedUserIds = listOf("member_2"),
                helperUserId = memberId,
            ),
            marketShift(
                id = "next_market",
                date = LocalDate.of(2026, 5, 10),
                assignedUserIds = listOf("member_3", memberId),
            ),
        )
        val nowMillis = millis(LocalDate.of(2026, 5, 2))

        assertEquals("next_lead", shifts.nextDeliveryLeadShift(memberId, emptyList(), nowMillis)?.id)
        assertEquals("next_helper", shifts.nextDeliveryHelperShift(memberId, emptyList(), nowMillis)?.id)
        assertEquals("next_market", shifts.nextMarketAssignedShift(memberId, emptyList(), nowMillis)?.id)
    }

    @Test
    fun nextShiftHelpersAndBoardWindowUseDeliveryOverrides() {
        val memberId = "member_1"
        val shiftedDelivery = deliveryShift(
            id = "shifted_delivery",
            date = LocalDate.of(2026, 5, 6),
            assignedUserIds = listOf(memberId),
        )
        val previousDelivery = deliveryShift(
            id = "previous_delivery",
            date = LocalDate.of(2026, 4, 29),
            assignedUserIds = listOf("member_2"),
        )
        val override = DeliveryCalendarOverride(
            weekKey = shiftedDelivery.dateMillis.toWeekKey(),
            deliveryDateMillis = millis(LocalDate.of(2026, 5, 12)),
            ordersBlockedDateMillis = millis(LocalDate.of(2026, 5, 13)),
            ordersOpenAtMillis = millis(LocalDate.of(2026, 5, 14)),
            ordersCloseAtMillis = millis(LocalDate.of(2026, 5, 17)),
            updatedBy = "admin",
            updatedAtMillis = 10,
        )
        val shifts = listOf(previousDelivery, shiftedDelivery)
        val nowMillis = millis(LocalDate.of(2026, 5, 8))

        assertEquals("shifted_delivery", shifts.nextDeliveryLeadShift(memberId, listOf(override), nowMillis)?.id)

        val window = shifts.shiftBoardWindow(
            overrides = listOf(override),
            nowMillis = nowMillis,
        )
        assertEquals("shifted_delivery", window.highlightedShiftId)
        assertFalse(window.highlights("previous_delivery"))
        assertTrue(window.highlights("shifted_delivery"))
        assertEquals("shifted_delivery", window.targetShiftId)

        val todayDelivery = deliveryShift(
            id = "today_delivery",
            date = LocalDate.of(2026, 5, 8),
            assignedUserIds = listOf(memberId),
        )
        val tomorrowDelivery = deliveryShift(
            id = "tomorrow_delivery",
            date = LocalDate.of(2026, 5, 9),
            assignedUserIds = listOf(memberId),
        )
        val todayWindow = listOf(todayDelivery, tomorrowDelivery).shiftBoardWindow(
            overrides = emptyList(),
            nowMillis = millis(LocalDate.of(2026, 5, 8)) + 15L * 60L * 60L * 1_000L,
        )
        assertEquals("today_delivery", todayWindow.highlightedShiftId)
        assertTrue(todayWindow.highlights("today_delivery"))
        assertFalse(todayWindow.highlights("tomorrow_delivery"))
    }

    @Test
    fun visibleShiftSwapActivityIncludesAllTypesAndSkipsDismissedEmptyState() {
        val memberId = "member_1"
        val incoming = shiftSwapRequest(
            id = "incoming",
            requesterUserId = "member_2",
            requestedShiftId = "delivery_1",
            candidates = listOf(ShiftSwapCandidate(userId = memberId, shiftId = "delivery_2")),
        )
        val waiting = shiftSwapRequest(
            id = "waiting",
            requesterUserId = memberId,
            requestedShiftId = "market_1",
            candidates = listOf(ShiftSwapCandidate(userId = "member_3", shiftId = "market_2")),
        )
        val response = shiftSwapRequest(
            id = "response",
            requesterUserId = memberId,
            requestedShiftId = "delivery_3",
            candidates = listOf(ShiftSwapCandidate(userId = "member_4", shiftId = "delivery_4")),
            responses = listOf(
                ShiftSwapResponse(
                    userId = "member_4",
                    shiftId = "delivery_4",
                    status = ShiftSwapResponseStatus.AVAILABLE,
                    respondedAtMillis = 20,
                ),
            ),
        )
        val dismissedHistory = shiftSwapRequest(
            id = "dismissed_history",
            requesterUserId = memberId,
            requestedShiftId = "market_3",
            candidates = emptyList(),
            status = ShiftSwapRequestStatus.APPLIED,
        )
        val unrelatedHistory = shiftSwapRequest(
            id = "unrelated_history",
            requesterUserId = "member_5",
            requestedShiftId = "market_4",
            candidates = listOf(ShiftSwapCandidate(userId = "member_6", shiftId = "market_5")),
            status = ShiftSwapRequestStatus.APPLIED,
        )

        val activity = listOf(incoming, waiting, response, dismissedHistory, unrelatedHistory).visibleShiftSwapActivity(
            currentMemberId = memberId,
            dismissedRequestIds = setOf("dismissed_history"),
        )

        assertTrue(activity.hasContent)
        assertEquals(listOf("incoming"), activity.incoming.map { it.first.id })
        assertEquals(listOf("response"), activity.availableResponses.map { it.request.id })
        assertEquals(listOf("waiting"), activity.waiting.map { it.id })
        assertTrue(activity.history.isEmpty())
        assertFalse(
            listOf(dismissedHistory).hasVisibleShiftSwapActivity(
                currentMemberId = memberId,
                dismissedRequestIds = setOf("dismissed_history"),
            ),
        )
    }

    private fun deliveryShift(
        id: String,
        date: LocalDate,
        assignedUserIds: List<String>,
        helperUserId: String? = null,
    ): ShiftAssignment =
        ShiftAssignment(
            id = id,
            type = ShiftType.DELIVERY,
            dateMillis = millis(date),
            assignedUserIds = assignedUserIds,
            helperUserId = helperUserId,
            status = ShiftStatus.CONFIRMED,
            source = "test",
            createdAtMillis = 0,
            updatedAtMillis = 0,
        )

    private fun marketShift(
        id: String,
        date: LocalDate,
        assignedUserIds: List<String>,
    ): ShiftAssignment =
        ShiftAssignment(
            id = id,
            type = ShiftType.MARKET,
            dateMillis = millis(date),
            assignedUserIds = assignedUserIds,
            helperUserId = null,
            status = ShiftStatus.CONFIRMED,
            source = "test",
            createdAtMillis = 0,
            updatedAtMillis = 0,
        )

    private fun shiftSwapRequest(
        id: String,
        requesterUserId: String,
        requestedShiftId: String,
        candidates: List<ShiftSwapCandidate>,
        responses: List<ShiftSwapResponse> = emptyList(),
        status: ShiftSwapRequestStatus = ShiftSwapRequestStatus.OPEN,
    ): ShiftSwapRequest =
        ShiftSwapRequest(
            id = id,
            requestedShiftId = requestedShiftId,
            requesterUserId = requesterUserId,
            reason = "",
            status = status,
            candidates = candidates,
            responses = responses,
            selectedCandidateUserId = null,
            selectedCandidateShiftId = null,
            requestedAtMillis = 1,
            confirmedAtMillis = null,
            appliedAtMillis = null,
        )

    private fun millis(date: LocalDate): Long =
        date.atStartOfDay(zone).toInstant().toEpochMilli()
}
