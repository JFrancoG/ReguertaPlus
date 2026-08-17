package com.reguerta.user.presentation.auth

import com.reguerta.user.presentation.root.SessionUiState
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthSecretLifetimePolicyTest {
    @Test
    fun `global session state contains no password fields`() {
        val stateFieldNames = SessionUiState::class.java.declaredFields
            .map { field -> field.name }

        val forbiddenSecretFields = setOf(
            "passwordInput",
            "registerPasswordInput",
            "registerRepeatPasswordInput",
        )

        assertTrue(
            "SessionUiState must not retain authentication passwords: $stateFieldNames",
            stateFieldNames.none { fieldName -> fieldName in forbiddenSecretFields },
        )
    }

    @Test
    fun `accepted submission releases the route secret`() {
        val remainingSecret = retainedAuthSecretAfterSubmission(
            secret = "test-pass12",
            submissionAccepted = true,
        )
        val validationRevision = nextAuthSecretValidationRevision(
            currentRevision = 4,
            submissionAccepted = true,
        )

        assertTrue(remainingSecret.isEmpty())
        assertTrue(validationRevision == 5)
    }

    @Test
    fun `rejected submission preserves the route secret for correction`() {
        val remainingSecret = retainedAuthSecretAfterSubmission(
            secret = "short",
            submissionAccepted = false,
        )
        val validationRevision = nextAuthSecretValidationRevision(
            currentRevision = 4,
            submissionAccepted = false,
        )

        assertTrue(remainingSecret == "short")
        assertTrue(validationRevision == 4)
    }
}
