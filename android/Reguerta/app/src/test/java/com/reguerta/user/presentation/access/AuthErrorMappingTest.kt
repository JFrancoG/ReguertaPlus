package com.reguerta.user.presentation.access

import com.reguerta.user.R
import com.reguerta.user.domain.access.AuthSignInFailureReason
import org.junit.Assert.assertEquals
import org.junit.Test

class AuthErrorMappingTest {
    @Test
    fun `maps sign in errors to field or global messages`() {
        val invalidCredentials = mapAuthFailure(
            reason = AuthSignInFailureReason.INVALID_CREDENTIALS,
            flow = AuthErrorFlow.SIGN_IN,
        )
        assertEquals(R.string.auth_error_invalid_credentials, invalidCredentials.passwordErrorRes)
        assertEquals(null, invalidCredentials.emailErrorRes)

        val network = mapAuthFailure(
            reason = AuthSignInFailureReason.NETWORK,
            flow = AuthErrorFlow.SIGN_IN,
        )
        assertEquals(R.string.auth_error_network, network.globalMessageRes)
    }

    @Test
    fun `maps sign up errors to register fields`() {
        val alreadyInUse = mapAuthFailure(
            reason = AuthSignInFailureReason.EMAIL_ALREADY_IN_USE,
            flow = AuthErrorFlow.SIGN_UP,
        )
        assertEquals(R.string.auth_error_email_already_in_use, alreadyInUse.emailErrorRes)

        val weakPassword = mapAuthFailure(
            reason = AuthSignInFailureReason.WEAK_PASSWORD,
            flow = AuthErrorFlow.SIGN_UP,
        )
        assertEquals(R.string.auth_error_weak_password, weakPassword.passwordErrorRes)
    }

    @Test
    fun `maps password reset unsupported reasons to unknown global message`() {
        val unsupported = mapAuthFailure(
            reason = AuthSignInFailureReason.INVALID_CREDENTIALS,
            flow = AuthErrorFlow.PASSWORD_RESET,
        )
        assertEquals(R.string.auth_error_unknown, unsupported.globalMessageRes)
    }
}
