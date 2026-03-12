package com.reguerta.user.domain.access

enum class UnauthorizedReason {
    USER_NOT_AUTHORIZED,
}

sealed interface AccessResolutionResult {
    data class Authorized(val member: Member) : AccessResolutionResult

    data class Unauthorized(val reason: UnauthorizedReason) : AccessResolutionResult
}
