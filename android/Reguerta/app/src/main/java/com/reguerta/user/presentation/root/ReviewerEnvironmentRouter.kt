package com.reguerta.user.presentation.root

import com.reguerta.user.domain.access.AuthPrincipal

interface ReviewerEnvironmentRouter {
    suspend fun applyRoutingFor(principal: AuthPrincipal)

    fun resetToBaseEnvironment()
}

object NoOpReviewerEnvironmentRouter : ReviewerEnvironmentRouter {
    override suspend fun applyRoutingFor(principal: AuthPrincipal) = Unit

    override fun resetToBaseEnvironment() = Unit
}
