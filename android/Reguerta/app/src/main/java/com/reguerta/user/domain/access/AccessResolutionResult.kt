package com.reguerta.user.domain.access

sealed interface AccessResolutionResult {
    data class Authorized(val member: Member) : AccessResolutionResult

    data class Unauthorized(val message: String) : AccessResolutionResult
}
