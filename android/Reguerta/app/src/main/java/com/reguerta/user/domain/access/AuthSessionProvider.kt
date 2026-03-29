package com.reguerta.user.domain.access

enum class AuthSignInFailureReason {
    INVALID_EMAIL,
    INVALID_CREDENTIALS,
    EMAIL_ALREADY_IN_USE,
    WEAK_PASSWORD,
    USER_NOT_FOUND,
    USER_DISABLED,
    TOO_MANY_REQUESTS,
    NETWORK,
    UNKNOWN,
}

sealed interface AuthSignInResult {
    data class Success(val principal: AuthPrincipal) : AuthSignInResult

    data class Failure(val reason: AuthSignInFailureReason) : AuthSignInResult
}

sealed interface AuthPasswordResetResult {
    data object Success : AuthPasswordResetResult

    data class Failure(val reason: AuthSignInFailureReason) : AuthPasswordResetResult
}

sealed interface AuthSessionRefreshResult {
    data object NoSession : AuthSessionRefreshResult

    data class Active(val principal: AuthPrincipal) : AuthSessionRefreshResult

    data object Expired : AuthSessionRefreshResult
}

interface AuthSessionProvider {
    suspend fun signIn(email: String, password: String): AuthSignInResult

    suspend fun signUp(email: String, password: String): AuthSignInResult

    suspend fun sendPasswordReset(email: String): AuthPasswordResetResult

    suspend fun refreshCurrentSession(): AuthSessionRefreshResult

    fun signOut()
}
