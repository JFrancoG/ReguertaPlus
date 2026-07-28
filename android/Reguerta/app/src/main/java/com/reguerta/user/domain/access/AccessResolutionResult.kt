package com.reguerta.user.domain.access

enum class UnauthorizedReason {
    USER_NOT_FOUND_IN_AUTHORIZED_USERS,
    USER_ACCESS_RESTRICTED,
    EMAIL_NOT_VERIFIED,
}

sealed interface AccessResolutionResult {
    data class Authorized(
        val member: Member,
        val environment: String,
    ) : AccessResolutionResult

    data class Unauthorized(val reason: UnauthorizedReason) : AccessResolutionResult
}
