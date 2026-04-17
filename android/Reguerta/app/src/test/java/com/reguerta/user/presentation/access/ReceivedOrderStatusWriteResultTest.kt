package com.reguerta.user.presentation.access

import org.junit.Assert.assertEquals
import org.junit.Test

class ReceivedOrderStatusWriteResultTest {
    @Test
    fun `maps permission denied token in message`() {
        val error = IllegalStateException("PERMISSION_DENIED: missing or insufficient permissions")

        assertEquals(
            ReceivedOrderStatusWriteResult.PERMISSION_DENIED,
            error.toReceivedOrderStatusWriteResult(),
        )
    }

    @Test
    fun `maps unknown exception as generic failure`() {
        val error = IllegalStateException("boom")

        assertEquals(
            ReceivedOrderStatusWriteResult.FAILURE,
            error.toReceivedOrderStatusWriteResult(),
        )
    }
}
