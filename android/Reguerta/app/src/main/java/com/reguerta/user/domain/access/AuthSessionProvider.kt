package com.reguerta.user.domain.access

enum class AuthSignInFailureReason {
    INVALID_EMAIL,
    INVALID_CREDENTIALS,
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

interface AuthSessionProvider {
    suspend fun signIn(email: String, password: String): AuthSignInResult

    fun signOut()
}
