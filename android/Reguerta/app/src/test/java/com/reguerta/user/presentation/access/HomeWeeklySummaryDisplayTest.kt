package com.reguerta.user.presentation.access

import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.access.ProducerParity
import com.reguerta.user.domain.calendar.DeliveryWeekday
import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.domain.shifts.ShiftStatus
import com.reguerta.user.domain.shifts.ShiftType
import java.time.LocalDate
import java.time.ZoneId
import org.junit.Assert.assertEquals
import org.junit.Test

class HomeWeeklySummaryDisplayTest {
    private val zone = ZoneId.of("Europe/Madrid")

    @Test
    fun weeklySummary_usesCurrentWeekBeforeDelivery() {
        val display = resolveHomeWeeklySummaryDisplay(
            nowMillis = LocalDate.of(2026, 5, 6).atStartOfDay(zone).toInstant().toEpochMilli(),
            defaultDeliveryDayOfWeek = DeliveryWeekday.FRIDAY,
            deliveryCalendarOverrides = emptyList(),
            shifts = listOf(deliveryShift("delivery_2026w19", LocalDate.of(2026, 5, 8))),
            members = members,
            currentMemberId = "member_1",
            orderState = HomeOrderStateDisplay.UNCONFIRMED,
            zoneId = zone,
        )

        assertEquals("2026-W19", display.weekKey)
        assertEquals("4 may - 8 may", display.weekRangeLabel)
        assertEquals("Carmen", display.responsibleName)
        assertEquals("Javier", display.helperName)
    }

    @Test
    fun weeklySummary_movesToNextWeekAfterDelivery() {
        val display = resolveHomeWeeklySummaryDisplay(
            nowMillis = LocalDate.of(2026, 5, 9).atStartOfDay(zone).toInstant().toEpochMilli(),
            defaultDeliveryDayOfWeek = DeliveryWeekday.FRIDAY,
            deliveryCalendarOverrides = emptyList(),
            shifts = listOf(
                deliveryShift("delivery_2026w19", LocalDate.of(2026, 5, 8)),
                deliveryShift("delivery_2026w20", LocalDate.of(2026, 5, 15)),
            ),
            members = members,
            currentMemberId = "member_1",
            orderState = HomeOrderStateDisplay.NOT_STARTED,
            zoneId = zone,
        )

        assertEquals("2026-W20", display.weekKey)
        assertEquals("11 may - 15 may", display.weekRangeLabel)
    }

    @Test
    fun orderStateLabelsPreserveRequiredMapping() {
        assertEquals(HomeOrderStateDisplay.NOT_STARTED, HomeOrderStateDisplay.NOT_STARTED)
        assertEquals(HomeOrderStateDisplay.UNCONFIRMED, HomeOrderStateDisplay.UNCONFIRMED)
        assertEquals(HomeOrderStateDisplay.COMPLETED, HomeOrderStateDisplay.COMPLETED)
    }

    private fun deliveryShift(id: String, date: LocalDate): ShiftAssignment =
        ShiftAssignment(
            id = id,
            type = ShiftType.DELIVERY,
            dateMillis = date.atStartOfDay(zone).toInstant().toEpochMilli(),
            assignedUserIds = listOf("member_1"),
            helperUserId = "member_2",
            status = ShiftStatus.CONFIRMED,
            source = "test",
            createdAtMillis = 0,
            updatedAtMillis = 0,
        )

    private val members = listOf(
        Member(
            id = "member_1",
            displayName = "Carmen",
            normalizedEmail = "carmen@reguerta.test",
            authUid = null,
            roles = setOf(MemberRole.MEMBER),
            isActive = true,
            producerCatalogEnabled = true,
        ),
        Member(
            id = "member_2",
            displayName = "Javier",
            normalizedEmail = "javier@reguerta.test",
            authUid = null,
            roles = setOf(MemberRole.MEMBER),
            isActive = true,
            producerCatalogEnabled = true,
        ),
        Member(
            id = "producer_1",
            displayName = "Huerta Norte",
            companyName = "Huerta Norte",
            normalizedEmail = "huerta@reguerta.test",
            authUid = null,
            roles = setOf(MemberRole.PRODUCER),
            isActive = true,
            producerCatalogEnabled = true,
            producerParity = ProducerParity.ODD,
        ),
    )
}
