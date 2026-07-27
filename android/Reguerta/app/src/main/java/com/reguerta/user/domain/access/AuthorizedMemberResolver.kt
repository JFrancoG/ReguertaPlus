package com.reguerta.user.domain.access

sealed interface AuthorizedMemberResolution {
    data class Authorized(
        val memberId: String,
        val roles: Set<MemberRole>,
        val isActive: Boolean,
        val environment: String,
        val firstLoginLinked: Boolean,
    ) : AuthorizedMemberResolution

    data class Unauthorized(
        val isActive: Boolean?,
        val emailVerificationRequired: Boolean = false,
    ) : AuthorizedMemberResolution
}

interface AuthorizedMemberResolver {
    suspend fun resolve(): AuthorizedMemberResolution
}
