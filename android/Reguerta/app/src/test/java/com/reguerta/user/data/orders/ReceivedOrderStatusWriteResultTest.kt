package com.reguerta.user.data.orders

import com.reguerta.user.domain.orders.ReceivedOrderStatusWriteResult
import java.util.concurrent.ExecutionException
import org.junit.Assert.assertEquals
import org.junit.Test

class ReceivedOrderStatusWriteResultTest {
    @Test
    fun `unexpected exception with denial text remains a generic failure`() {
        val error = IllegalStateException("PERMISSION_DENIED: missing or insufficient permissions")

        assertEquals(ReceivedOrderStatusWriteResult.FAILURE, error.toReceivedOrderStatusWriteResult())
    }

    @Test
    fun `await wrapper without a Firestore cause remains a generic failure`() {
        val error = ExecutionException("PERMISSION_DENIED", IllegalStateException("network unavailable"))

        assertEquals(ReceivedOrderStatusWriteResult.FAILURE, error.toReceivedOrderStatusWriteResult())
    }

    @Test
    fun `unknown exception remains a generic failure`() {
        val error = IllegalStateException("boom")

        assertEquals(ReceivedOrderStatusWriteResult.FAILURE, error.toReceivedOrderStatusWriteResult())
    }
}
