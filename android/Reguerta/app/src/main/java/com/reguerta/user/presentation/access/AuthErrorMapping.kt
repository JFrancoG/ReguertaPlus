package com.reguerta.user.presentation.access

import androidx.annotation.StringRes
import com.reguerta.user.R
import com.reguerta.user.domain.access.AuthSignInFailureReason

enum class AuthErrorFlow {
    SIGN_IN,
    SIGN_UP,
    PASSWORD_RESET,
}

data class AuthErrorUiMapping(
    @param:StringRes val emailErrorRes: Int? = null,
    @param:StringRes val passwordErrorRes: Int? = null,
    @param:StringRes val globalMessageRes: Int? = null,
)

fun mapAuthFailure(reason: AuthSignInFailureReason, flow: AuthErrorFlow): AuthErrorUiMapping =
    when (flow) {
        AuthErrorFlow.SIGN_IN -> when (reason) {
            AuthSignInFailureReason.INVALID_EMAIL ->
                AuthErrorUiMapping(emailErrorRes = R.string.feedback_email_invalid)
            AuthSignInFailureReason.INVALID_CREDENTIALS ->
                AuthErrorUiMapping(passwordErrorRes = R.string.auth_error_invalid_credentials)
            AuthSignInFailureReason.EMAIL_ALREADY_IN_USE ->
                AuthErrorUiMapping(emailErrorRes = R.string.auth_error_email_already_in_use)
            AuthSignInFailureReason.WEAK_PASSWORD ->
                AuthErrorUiMapping(passwordErrorRes = R.string.auth_error_weak_password)
            AuthSignInFailureReason.USER_NOT_FOUND ->
                AuthErrorUiMapping(emailErrorRes = R.string.auth_error_user_not_found)
            AuthSignInFailureReason.USER_DISABLED ->
                AuthErrorUiMapping(emailErrorRes = R.string.auth_error_user_disabled)
            AuthSignInFailureReason.TOO_MANY_REQUESTS ->
                AuthErrorUiMapping(globalMessageRes = R.string.auth_error_too_many_requests)
            AuthSignInFailureReason.NETWORK ->
                AuthErrorUiMapping(globalMessageRes = R.string.auth_error_network)
            AuthSignInFailureReason.UNKNOWN ->
                AuthErrorUiMapping(globalMessageRes = R.string.auth_error_unknown)
        }

        AuthErrorFlow.SIGN_UP -> when (reason) {
            AuthSignInFailureReason.INVALID_EMAIL ->
                AuthErrorUiMapping(emailErrorRes = R.string.feedback_email_invalid)
            AuthSignInFailureReason.INVALID_CREDENTIALS ->
                AuthErrorUiMapping(passwordErrorRes = R.string.auth_error_invalid_credentials)
            AuthSignInFailureReason.EMAIL_ALREADY_IN_USE ->
                AuthErrorUiMapping(emailErrorRes = R.string.auth_error_email_already_in_use)
            AuthSignInFailureReason.WEAK_PASSWORD ->
                AuthErrorUiMapping(passwordErrorRes = R.string.auth_error_weak_password)
            AuthSignInFailureReason.USER_NOT_FOUND ->
                AuthErrorUiMapping(emailErrorRes = R.string.auth_error_user_not_found)
            AuthSignInFailureReason.USER_DISABLED ->
                AuthErrorUiMapping(emailErrorRes = R.string.auth_error_user_disabled)
            AuthSignInFailureReason.TOO_MANY_REQUESTS ->
                AuthErrorUiMapping(globalMessageRes = R.string.auth_error_too_many_requests)
            AuthSignInFailureReason.NETWORK ->
                AuthErrorUiMapping(globalMessageRes = R.string.auth_error_network)
            AuthSignInFailureReason.UNKNOWN ->
                AuthErrorUiMapping(globalMessageRes = R.string.auth_error_unknown)
        }

        AuthErrorFlow.PASSWORD_RESET -> when (reason) {
            AuthSignInFailureReason.INVALID_EMAIL ->
                AuthErrorUiMapping(emailErrorRes = R.string.feedback_email_invalid)
            AuthSignInFailureReason.USER_NOT_FOUND ->
                AuthErrorUiMapping(emailErrorRes = R.string.auth_error_user_not_found)
            AuthSignInFailureReason.USER_DISABLED ->
                AuthErrorUiMapping(emailErrorRes = R.string.auth_error_user_disabled)
            AuthSignInFailureReason.TOO_MANY_REQUESTS ->
                AuthErrorUiMapping(globalMessageRes = R.string.auth_error_too_many_requests)
            AuthSignInFailureReason.NETWORK ->
                AuthErrorUiMapping(globalMessageRes = R.string.auth_error_network)
            AuthSignInFailureReason.UNKNOWN,
            AuthSignInFailureReason.INVALID_CREDENTIALS,
            AuthSignInFailureReason.EMAIL_ALREADY_IN_USE,
            AuthSignInFailureReason.WEAK_PASSWORD,
            ->
                AuthErrorUiMapping(globalMessageRes = R.string.auth_error_unknown)
        }
    }
