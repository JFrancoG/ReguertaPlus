package com.reguerta.user.data.access

import com.reguerta.user.domain.access.AuthSignInFailureReason
import org.junit.Assert.assertEquals
import org.junit.Test

class FirebaseAuthSessionProviderTest {
    @Test
    fun `maps credential related firebase error codes`() {
        assertEquals(
            AuthSignInFailureReason.INVALID_CREDENTIALS,
            mapFirebaseAuthErrorCode("ERROR_WRONG_PASSWORD"),
        )
        assertEquals(
            AuthSignInFailureReason.INVALID_CREDENTIALS,
            mapFirebaseAuthErrorCode("ERROR_INVALID_CREDENTIAL"),
        )
        assertEquals(
            AuthSignInFailureReason.INVALID_CREDENTIALS,
            mapFirebaseAuthErrorCode("ERROR_INVALID_LOGIN_CREDENTIALS"),
        )
    }

    @Test
    fun `maps account related firebase error codes`() {
        assertEquals(AuthSignInFailureReason.INVALID_EMAIL, mapFirebaseAuthErrorCode("ERROR_INVALID_EMAIL"))
        assertEquals(AuthSignInFailureReason.USER_NOT_FOUND, mapFirebaseAuthErrorCode("ERROR_USER_NOT_FOUND"))
        assertEquals(AuthSignInFailureReason.USER_DISABLED, mapFirebaseAuthErrorCode("ERROR_USER_DISABLED"))
    }

    @Test
    fun `maps operational firebase error codes and defaults unknown`() {
        assertEquals(AuthSignInFailureReason.TOO_MANY_REQUESTS, mapFirebaseAuthErrorCode("ERROR_TOO_MANY_REQUESTS"))
        assertEquals(AuthSignInFailureReason.NETWORK, mapFirebaseAuthErrorCode("ERROR_NETWORK_REQUEST_FAILED"))
        assertEquals(AuthSignInFailureReason.UNKNOWN, mapFirebaseAuthErrorCode("SOMETHING_ELSE"))
        assertEquals(AuthSignInFailureReason.UNKNOWN, mapFirebaseAuthErrorCode(null))
    }
}
