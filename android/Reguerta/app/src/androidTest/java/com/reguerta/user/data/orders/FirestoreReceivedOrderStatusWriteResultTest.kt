package com.reguerta.user.data.orders

import com.google.android.gms.tasks.Tasks
import com.google.firebase.firestore.FirebaseFirestoreException
import com.reguerta.user.domain.orders.ReceivedOrderStatusWriteResult
import java.util.concurrent.ExecutionException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

/** Uses real SDK exception values without initializing Firebase or accessing a service. */
class FirestoreReceivedOrderStatusWriteResultTest {
    @Test
    fun directDenialUsesTheSdkCodeWithoutNeedingDenialText() {
        val error = FirebaseFirestoreException("write rejected", FirebaseFirestoreException.Code.PERMISSION_DENIED)

        assertEquals(ReceivedOrderStatusWriteResult.PERMISSION_DENIED, error.toReceivedOrderStatusWriteResult())
    }

    @Test
    fun taskAwaitDenialUsesTheWrappedSdkCode() {
        val cause = FirebaseFirestoreException("write rejected", FirebaseFirestoreException.Code.PERMISSION_DENIED)
        val task = Tasks.forException<Void>(cause)
        val error = assertThrows(ExecutionException::class.java) {
            Tasks.await(task)
        }

        assertEquals(ReceivedOrderStatusWriteResult.PERMISSION_DENIED, error.toReceivedOrderStatusWriteResult())
    }

    @Test
    fun unavailableCodeOverridesMisleadingDenialText() {
        val error = FirebaseFirestoreException(
            "PERMISSION_DENIED: stale diagnostic text",
            FirebaseFirestoreException.Code.UNAVAILABLE,
        )

        assertEquals(ReceivedOrderStatusWriteResult.FAILURE, error.toReceivedOrderStatusWriteResult())
    }

    @Test
    fun awaitWrapperTextDoesNotOverrideItsFirestoreCode() {
        val cause = FirebaseFirestoreException("network unavailable", FirebaseFirestoreException.Code.UNAVAILABLE)
        val error = ExecutionException("PERMISSION_DENIED", cause)

        assertEquals(ReceivedOrderStatusWriteResult.FAILURE, error.toReceivedOrderStatusWriteResult())
    }

    @Test
    fun otherSdkFailuresRemainGeneric() {
        val error = FirebaseFirestoreException("document missing", FirebaseFirestoreException.Code.NOT_FOUND)

        assertEquals(ReceivedOrderStatusWriteResult.FAILURE, error.toReceivedOrderStatusWriteResult())
    }
}
