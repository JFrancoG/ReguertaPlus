package com.reguerta.user.presentation.orders

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MyOrderCheckoutOrderIdentityTest {
    @Test
    fun `new checkout uses the deterministic order id`() {
        assertEquals(
            "member-1_2026-W28",
            resolveMyOrderCheckoutOrderId(
                deterministicOrderId = "member-1_2026-W28",
                existingOrderIds = emptyList(),
            ),
        )
    }

    @Test
    fun `checkout reuses the unique historical order id`() {
        assertEquals(
            "historical-order-id",
            resolveMyOrderCheckoutOrderId(
                deterministicOrderId = "member-1_2026-W28",
                existingOrderIds = listOf("historical-order-id"),
            ),
        )
    }

    @Test
    fun `checkout fails closed when owner and week have duplicate orders`() {
        assertNull(
            resolveMyOrderCheckoutOrderId(
                deterministicOrderId = "member-1_2026-W28",
                existingOrderIds = listOf("historical-order-id", "duplicate-order-id"),
            ),
        )
    }

    @Test
    fun `duplicate query aliases for one document remain a single order`() {
        assertEquals(
            "historical-order-id",
            resolveMyOrderCheckoutOrderId(
                deterministicOrderId = "member-1_2026-W28",
                existingOrderIds = listOf("historical-order-id", "historical-order-id"),
            ),
        )
    }

    @Test
    fun `status lookup accepts only one existing owner week order`() {
        assertEquals(
            "historical-order-id",
            resolveUniqueExistingMyOrderId(
                listOf("historical-order-id", "historical-order-id"),
            ),
        )
        assertNull(resolveUniqueExistingMyOrderId(emptyList()))
        assertNull(
            resolveUniqueExistingMyOrderId(
                listOf("historical-order-id", "duplicate-order-id"),
            ),
        )
    }
}
