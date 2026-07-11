package com.reguerta.user.presentation.home

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HomeShellTitleTest {
    @Test
    fun normalMyOrderListHidesRedundantShellTitle() {
        assertTrue(
            shouldHideHomeShellTitle(
                destination = HomeDestination.MY_ORDER,
                isMyOrderCartVisible = false,
                isMyOrderReadOnlyMode = false,
            ),
        )
    }

    @Test
    fun editableCartKeepsItsContextualShellTitle() {
        assertFalse(
            shouldHideHomeShellTitle(
                destination = HomeDestination.MY_ORDER,
                isMyOrderCartVisible = true,
                isMyOrderReadOnlyMode = false,
            ),
        )
    }

    @Test
    fun receivedOrdersHidesRedundantShellTitle() {
        assertTrue(
            shouldHideHomeShellTitle(
                destination = HomeDestination.RECEIVED_ORDERS,
                isMyOrderCartVisible = false,
                isMyOrderReadOnlyMode = false,
            ),
        )
    }

    @Test
    fun otherDestinationsKeepTheirShellTitles() {
        assertFalse(
            shouldHideHomeShellTitle(
                destination = HomeDestination.NEWS,
                isMyOrderCartVisible = false,
                isMyOrderReadOnlyMode = false,
            ),
        )
    }
}
