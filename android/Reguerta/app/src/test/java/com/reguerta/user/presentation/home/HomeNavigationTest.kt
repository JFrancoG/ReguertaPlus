package com.reguerta.user.presentation.home

import org.junit.Assert.assertEquals
import org.junit.Test

class HomeNavigationTest {
    @Test
    fun adminBroadcastBackReturnsToDashboard() {
        assertEquals(
            HomeDestination.DASHBOARD,
            HomeDestination.ADMIN_BROADCAST.backDestination(),
        )
    }

    @Test
    fun contextualEditorsKeepTheirParentDestination() {
        assertEquals(
            HomeDestination.NEWS,
            HomeDestination.PUBLISH_NEWS.backDestination(),
        )
        assertEquals(
            HomeDestination.SHIFTS,
            HomeDestination.SHIFT_SWAP_REQUEST.backDestination(),
        )
    }
}
