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
        assertEquals("2026-W18", display.orderWeekKey)
        assertEquals("4 may - 10 may", display.weekRangeLabel)
        assertEquals("Huerta Sur", display.producerName)
        assertEquals(true, display.isConsultaPhase)
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
        assertEquals("2026-W19", display.orderWeekKey)
        assertEquals("11 may - 17 may", display.weekRangeLabel)
        assertEquals("Huerta Norte", display.producerName)
        assertEquals(false, display.isConsultaPhase)
    }

    @Test
    fun weeklySummary_afterWednesdayDeliveryUsesNextDeliveryCycleAndCurrentMarket() {
        val display = resolveHomeWeeklySummaryDisplay(
            nowMillis = LocalDate.of(2026, 5, 14).atStartOfDay(zone).toInstant().toEpochMilli(),
            defaultDeliveryDayOfWeek = DeliveryWeekday.FRIDAY,
            deliveryCalendarOverrides = emptyList(),
            shifts = listOf(
                deliveryShift("delivery_2026w20", LocalDate.of(2026, 5, 13)),
                deliveryShift(
                    id = "delivery_2026w21",
                    date = LocalDate.of(2026, 5, 20),
                    assignedUserIds = listOf("felix"),
                    helperUserId = "ana_belen",
                ),
                marketShift(
                    id = "market_2026w20",
                    date = LocalDate.of(2026, 5, 16),
                    assignedUserIds = listOf("valle", "angeles", "sandra"),
                ),
            ),
            members = may2026Members,
            currentMemberId = "member_1",
            orderState = HomeOrderStateDisplay.UNCONFIRMED,
            zoneId = zone,
        )

        assertEquals("2026-W21", display.weekKey)
        assertEquals("2026-W20", display.orderWeekKey)
        assertEquals("18 may - 24 may", display.weekRangeLabel)
        assertEquals("Semana 21", display.weekBadgeLabel)
        assertEquals("Tito Fernando", display.producerName)
        assertEquals("Mié 20", display.deliveryLabel)
        assertEquals("Sáb 16", display.marketLabel)
        assertEquals("Felix", display.responsibleName)
        assertEquals("Ana Belen", display.helperName)
        assertEquals(listOf("Valle", "Angeles", "Sandra"), display.marketResponsibleNames)
    }

    @Test
    fun weeklySummary_marketMovesToNextShiftTheDayAfterMarket() {
        val display = resolveHomeWeeklySummaryDisplay(
            nowMillis = LocalDate.of(2026, 5, 17).atStartOfDay(zone).toInstant().toEpochMilli(),
            defaultDeliveryDayOfWeek = DeliveryWeekday.FRIDAY,
            deliveryCalendarOverrides = emptyList(),
            shifts = listOf(
                deliveryShift("delivery_2026w20", LocalDate.of(2026, 5, 13)),
                deliveryShift("delivery_2026w21", LocalDate.of(2026, 5, 20)),
                marketShift(
                    id = "market_2026w20",
                    date = LocalDate.of(2026, 5, 16),
                    assignedUserIds = listOf("valle", "angeles", "sandra"),
                ),
                marketShift(
                    id = "market_2026w24",
                    date = LocalDate.of(2026, 6, 13),
                    assignedUserIds = listOf("angeles", "sandra", "valle"),
                ),
            ),
            members = may2026Members,
            currentMemberId = "member_1",
            orderState = HomeOrderStateDisplay.NOT_STARTED,
            zoneId = zone,
        )

        assertEquals("2026-W21", display.weekKey)
        assertEquals("Sáb 13", display.marketLabel)
        assertEquals(listOf("Angeles", "Sandra", "Valle"), display.marketResponsibleNames)
    }

    @Test
    fun orderStateLabelsPreserveRequiredMapping() {
        assertEquals(HomeOrderStateDisplay.NOT_STARTED, HomeOrderStateDisplay.NOT_STARTED)
        assertEquals(HomeOrderStateDisplay.UNCONFIRMED, HomeOrderStateDisplay.UNCONFIRMED)
        assertEquals(HomeOrderStateDisplay.COMPLETED, HomeOrderStateDisplay.COMPLETED)
    }

    private fun deliveryShift(
        id: String,
        date: LocalDate,
        assignedUserIds: List<String> = listOf("member_1"),
        helperUserId: String? = "member_2",
    ): ShiftAssignment =
        ShiftAssignment(
            id = id,
            type = ShiftType.DELIVERY,
            dateMillis = date.atStartOfDay(zone).toInstant().toEpochMilli(),
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
        assignedUserIds: List<String> = listOf("member_1", "member_2", "member_3"),
    ): ShiftAssignment =
        ShiftAssignment(
            id = id,
            type = ShiftType.MARKET,
            dateMillis = date.atStartOfDay(zone).toInstant().toEpochMilli(),
            assignedUserIds = assignedUserIds,
            helperUserId = null,
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
            id = "member_3",
            displayName = "Luz",
            normalizedEmail = "luz@reguerta.test",
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
        Member(
            id = "producer_2",
            displayName = "Huerta Sur",
            companyName = "Huerta Sur",
            normalizedEmail = "sur@reguerta.test",
            authUid = null,
            roles = setOf(MemberRole.PRODUCER),
            isActive = true,
            producerCatalogEnabled = true,
            producerParity = ProducerParity.EVEN,
        ),
    )

    private val may2026Members = listOf(
        Member(
            id = "felix",
            displayName = "Felix",
            normalizedEmail = "felix@reguerta.test",
            authUid = null,
            roles = setOf(MemberRole.MEMBER),
            isActive = true,
            producerCatalogEnabled = true,
        ),
        Member(
            id = "ana_belen",
            displayName = "Ana Belen",
            normalizedEmail = "ana.belen@reguerta.test",
            authUid = null,
            roles = setOf(MemberRole.MEMBER),
            isActive = true,
            producerCatalogEnabled = true,
        ),
        Member(
            id = "valle",
            displayName = "Valle",
            normalizedEmail = "valle@reguerta.test",
            authUid = null,
            roles = setOf(MemberRole.MEMBER),
            isActive = true,
            producerCatalogEnabled = true,
        ),
        Member(
            id = "angeles",
            displayName = "Angeles",
            normalizedEmail = "angeles@reguerta.test",
            authUid = null,
            roles = setOf(MemberRole.MEMBER),
            isActive = true,
            producerCatalogEnabled = true,
        ),
        Member(
            id = "sandra",
            displayName = "Sandra",
            normalizedEmail = "sandra@reguerta.test",
            authUid = null,
            roles = setOf(MemberRole.MEMBER),
            isActive = true,
            producerCatalogEnabled = true,
        ),
        Member(
            id = "producer_tito_fernando",
            displayName = "Tito Fernando",
            companyName = "Tito Fernando",
            normalizedEmail = "tito.fernando@reguerta.test",
            authUid = null,
            roles = setOf(MemberRole.PRODUCER),
            isActive = true,
            producerCatalogEnabled = true,
            producerParity = ProducerParity.EVEN,
        ),
        Member(
            id = "producer_laurel",
            displayName = "El Laurel de Cantillo",
            companyName = "El Laurel de Cantillo",
            normalizedEmail = "laurel@reguerta.test",
            authUid = null,
            roles = setOf(MemberRole.PRODUCER),
            isActive = true,
            producerCatalogEnabled = true,
            producerParity = ProducerParity.ODD,
        ),
    )
}
