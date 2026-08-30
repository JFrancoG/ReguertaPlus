package com.reguerta.user.presentation.shifts

import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.domain.shifts.ShiftStatus
import com.reguerta.user.domain.shifts.ShiftType
import java.time.LocalDate
import java.time.ZoneId
import org.junit.Assert.assertEquals
import org.junit.Test

class ShiftSeasonBoundaryProjectionTest {
    private val zone = ZoneId.of("Europe/Madrid")

    @Test
    fun boardAndUpcomingRolesContinueAcrossSeptemberBoundary() {
        val memberId = "member_1"
        val priorSeasonDelivery = shift(
            id = "delivery_2026_08_26",
            type = ShiftType.DELIVERY,
            date = LocalDate.of(2026, 8, 26),
            assignedUserIds = listOf("member_2"),
        )
        val nextSeasonDelivery = shift(
            id = "delivery_2026_09_02",
            type = ShiftType.DELIVERY,
            date = LocalDate.of(2026, 9, 2),
            assignedUserIds = listOf(memberId),
        )
        val laterDelivery = shift(
            id = "delivery_2026_09_09",
            type = ShiftType.DELIVERY,
            date = LocalDate.of(2026, 9, 9),
            assignedUserIds = listOf("member_3"),
        )
        val nextSeasonMarket = shift(
            id = "market_2026_09_19",
            type = ShiftType.MARKET,
            date = LocalDate.of(2026, 9, 19),
            assignedUserIds = listOf("member_4", memberId, "member_5"),
        )
        val shifts = listOf(laterDelivery, nextSeasonMarket, nextSeasonDelivery, priorSeasonDelivery)
        val nowMillis = millis(LocalDate.of(2026, 8, 27))

        assertEquals(
            nextSeasonDelivery.id,
            shifts.nextDeliveryLeadShift(memberId, emptyList(), nowMillis)?.id,
        )
        assertEquals(
            priorSeasonDelivery.id,
            shifts.nextDeliveryHelperShift(memberId, emptyList(), nowMillis)?.id,
        )
        assertEquals(memberId, shifts.resolvedHelperUserIdFor(priorSeasonDelivery))
        assertEquals(
            nextSeasonMarket.id,
            shifts.nextMarketAssignedShift(memberId, emptyList(), nowMillis)?.id,
        )
        assertEquals(
            nextSeasonDelivery.id,
            shifts.shiftBoardWindow(emptyList(), nowMillis).highlightedShiftId,
        )
    }

    private fun shift(
        id: String,
        type: ShiftType,
        date: LocalDate,
        assignedUserIds: List<String>,
    ): ShiftAssignment =
        ShiftAssignment(
            id = id,
            type = type,
            dateMillis = millis(date),
            assignedUserIds = assignedUserIds,
            helperUserId = null,
            status = ShiftStatus.CONFIRMED,
            source = "test",
            createdAtMillis = 0,
            updatedAtMillis = 0,
        )

    private fun millis(date: LocalDate): Long =
        date.atStartOfDay(zone).toInstant().toEpochMilli()
}
