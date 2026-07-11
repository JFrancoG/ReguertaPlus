package com.reguerta.user.domain.orders

import com.reguerta.user.data.orders.InMemoryOrdersRepository
import com.reguerta.user.presentation.orders.MyOrdersHistoryUiState
import com.reguerta.user.presentation.orders.MyOrdersHistoryWeekCopy
import com.reguerta.user.presentation.orders.ReceivedOrdersHistoryUiState
import com.reguerta.user.presentation.orders.localizedGenericOrderHistoryQuantityLabel
import com.reguerta.user.presentation.orders.toMyOrdersHistoryPresentation
import java.time.LocalDate
import java.time.ZoneId
import java.util.Locale
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OrderHistoryWeekTest {
    private val zone = ZoneId.of("Europe/Madrid")

    @Test
    fun previousIsoWeek_isSelectedRegardlessOfWeekday() {
        val monday = LocalDate.of(2026, 5, 25).atStartOfDay(zone).toInstant().toEpochMilli()
        val thursday = LocalDate.of(2026, 5, 28).atStartOfDay(zone).toInstant().toEpochMilli()
        val sunday = LocalDate.of(2026, 5, 31).atStartOfDay(zone).toInstant().toEpochMilli()

        assertEquals("2026-W21", orderHistoryPreviousIsoWeekKey(monday, zone))
        assertEquals("2026-W21", orderHistoryPreviousIsoWeekKey(thursday, zone))
        assertEquals("2026-W21", orderHistoryPreviousIsoWeekKey(sunday, zone))
    }

    @Test
    fun weekOptions_useIsoMondaySundayRangeAndContinuousBounds() {
        val options = orderHistoryContinuousWeekOptions(
            realWeekKeys = listOf("2026-W19", "2026-W21"),
            preferredWeekKey = "2026-W20",
        )

        assertEquals(listOf("2026-W19", "2026-W20", "2026-W21"), options.map { it.weekKey })
        assertEquals("4 may - 10 may", options[0].rangeLabel)
        assertEquals("11 may - 17 may", options[1].rangeLabel)
        assertEquals("18 may - 24 may", options[2].rangeLabel)
        assertEquals("2026 Semana 20", options[1].title)
        assertEquals("11 may - 17 may · 2026 Sem 20", options[1].pickerLabel)
        assertEquals("Pedido 18 may - 24 may", options[2].orderTitle)
    }

    @Test
    fun myOrdersHistoryPresentation_usesTheActiveEnglishLocale() {
        val option = requireNotNull(
            orderHistoryWeekOption(
                weekKey = "2026-W27",
                locale = Locale.US,
            ),
        )
        val presentation = option.toMyOrdersHistoryPresentation(
            locale = Locale.US,
            copy = MyOrdersHistoryWeekCopy(
                weekLabel = "Week",
                shortWeekLabel = "Wk",
                orderLabel = "Order",
            ),
        )

        assertEquals("Jun 29 - Jul 5", presentation.rangeLabel)
        assertEquals("2026 Week 27", presentation.title)
        assertEquals("Jun 29 - Jul 5 · 2026 Wk 27", presentation.pickerLabel)
        assertEquals("Order Jun 29 - Jul 5", presentation.orderTitle)
    }

    @Test
    fun myOrdersHistoryPresentation_localizesGenericUnitLabelsOnly() {
        assertEquals(
            "1 unit",
            localizedGenericOrderHistoryQuantityLabel("1 ud.", Locale.US, "1 unit", "%1\$d units"),
        )
        assertEquals(
            "3 units",
            localizedGenericOrderHistoryQuantityLabel("3 uds.", Locale.US, "1 unit", "%1\$d units"),
        )
        assertEquals(
            "1 kg",
            localizedGenericOrderHistoryQuantityLabel("1 kg", Locale.US, "1 unit", "%1\$d units"),
        )
    }

    @Test
    fun uiStateDerivesNavigationLimitsFromSelectedWeek() {
        val options = orderHistoryContinuousWeekOptions(
            realWeekKeys = listOf("2026-W19", "2026-W21"),
            preferredWeekKey = "2026-W20",
        )

        val first = MyOrdersHistoryUiState(availableWeeks = options, selectedWeekKey = "2026-W19")
        val middle = first.copy(selectedWeekKey = "2026-W20")
        val last = first.copy(selectedWeekKey = "2026-W21")

        assertFalse(first.canGoPrevious)
        assertTrue(first.canGoNext)
        assertTrue(middle.canGoPrevious)
        assertTrue(middle.canGoNext)
        assertTrue(last.canGoPrevious)
        assertFalse(last.canGoNext)
    }

    @Test
    fun inMemoryRepositoryKeepsMissingIntermediateWeeksEmpty() = runBlocking {
        val repository = InMemoryOrdersRepository()
        repository.setOrderHistoryWeekKeys("member_1", listOf("2026-W19", "2026-W21"))
        repository.setOrderSummary(
            "member_1",
            OrderSummarySnapshot(
                weekKey = "2026-W19",
                groups = listOf(
                    OrderSummaryGroup(
                        vendorId = "producer_even",
                        companyName = "Huerta Norte",
                        lines = emptyList(),
                        subtotal = 0.0,
                    ),
                ),
                total = 0.0,
            ),
        )

        assertEquals(listOf("2026-W19", "2026-W21"), repository.orderHistoryWeekKeys("member_1"))
        assertEquals(null, repository.orderSummarySnapshot("member_1", "2026-W20"))
    }

    @Test
    fun receivedOrdersHistoryUiStateFormatsTitleAndNavigationLimits() {
        val options = orderHistoryContinuousWeekOptions(
            realWeekKeys = listOf("2026-W19", "2026-W21"),
            preferredWeekKey = "2026-W20",
        )

        val middle = ReceivedOrdersHistoryUiState(
            availableWeeks = options,
            selectedWeekKey = "2026-W20",
        )
        val last = middle.copy(selectedWeekKey = "2026-W21")

        assertEquals("Pedidos recibidos 11 may - 17 may", middle.selectedTitle)
        assertEquals("11 may - 17 may · 2026 Sem 20", middle.selectedWeek?.pickerLabel)
        assertTrue(middle.canGoPrevious)
        assertTrue(middle.canGoNext)
        assertTrue(last.canGoPrevious)
        assertFalse(last.canGoNext)
    }

    @Test
    fun receivedOrdersHistoryUsesOldestGlobalOrderWhenProducerHasNoOrders() {
        val options = orderHistoryBrowsableWeekOptions(
            realWeekKeys = emptyList(),
            oldestOrderWeekKey = "2025-W01",
            preferredWeekKey = "2026-W27",
        )
        val state = ReceivedOrdersHistoryUiState(
            availableWeeks = options,
            selectedWeekKey = "2026-W27",
        )

        assertEquals("2025-W01", options.first().weekKey)
        assertEquals("2026-W27", options.last().weekKey)
        assertTrue(state.canGoPrevious)
        assertFalse(state.canGoNext)

        val optionsAfterDeleting2025 = orderHistoryBrowsableWeekOptions(
            realWeekKeys = emptyList(),
            oldestOrderWeekKey = "2026-W01",
            preferredWeekKey = "2026-W27",
        )
        assertEquals("2026-W01", optionsAfterDeleting2025.first().weekKey)
    }

    @Test
    fun receivedOrdersHistoryPresentation_usesTheActiveEnglishLocale() {
        val option = requireNotNull(orderHistoryWeekOption("2026-W27", Locale.US))
        val presentation = option.toMyOrdersHistoryPresentation(
            locale = Locale.US,
            copy = MyOrdersHistoryWeekCopy(
                weekLabel = "Week",
                shortWeekLabel = "Wk",
                orderLabel = "Received orders",
            ),
        )

        assertEquals("2026 Week 27", presentation.title)
        assertEquals("Jun 29 - Jul 5 · 2026 Wk 27", presentation.pickerLabel)
        assertEquals("Received orders Jun 29 - Jul 5", presentation.orderTitle)
    }

    @Test
    fun receivedOrdersHistoryRepositoryKeepsIntermediateWeeksReadOnly() = runBlocking {
        val repository = InMemoryOrdersRepository()
        repository.setReceivedOrdersHistoryWeekKeys("producer_even", listOf("2026-W19", "2026-W21"))
        repository.setReceivedOrdersSnapshot(
            producerId = "producer_even",
            weekKey = "2026-W19",
            snapshot = receivedOrdersSnapshot(status = ReceivedOrderProducerStatus.UNREAD),
        )

        assertEquals(listOf("2026-W19", "2026-W21"), repository.receivedOrdersHistoryWeekKeys("producer_even"))
        assertEquals(null, repository.receivedOrdersSnapshot("producer_even", "2026-W20", markUnreadAsRead = false))
        assertEquals(
            ReceivedOrderProducerStatus.UNREAD,
            repository.receivedOrdersSnapshot("producer_even", "2026-W19", markUnreadAsRead = false)
                ?.byMemberGroups
                ?.first()
                ?.producerStatus,
        )
        assertTrue(repository.receivedStatusUpdateRequests().isEmpty())
    }
}

private fun receivedOrdersSnapshot(status: ReceivedOrderProducerStatus): ReceivedOrdersSnapshot =
    ReceivedOrdersSnapshot(
        byProductRows = listOf(
            ReceivedOrdersProductRow(
                productId = "tomato",
                productName = "Tomates",
                productImageUrl = null,
                packagingLine = "Caja 1 kg",
                totalQuantity = 3.0,
                quantityUnitSingular = "caja",
                quantityUnitPlural = "cajas",
            ),
        ),
        byMemberGroups = listOf(
            ReceivedOrdersMemberGroup(
                id = "member_1|Carmen",
                orderId = "order_1",
                consumerDisplayName = "Carmen",
                producerStatus = status,
                lines = listOf(
                    ReceivedOrdersMemberLine(
                        id = "order_1|tomato",
                        productName = "Tomates",
                        packagingLine = "Caja 1 kg",
                        quantity = 3.0,
                        quantityUnitSingular = "caja",
                        quantityUnitPlural = "cajas",
                        subtotal = 6.0,
                    ),
                ),
                total = 6.0,
            ),
        ),
        generalTotal = 6.0,
    )
