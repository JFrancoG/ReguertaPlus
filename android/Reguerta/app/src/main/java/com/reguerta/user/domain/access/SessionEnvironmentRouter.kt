package com.reguerta.user.domain.access

interface SessionEnvironmentRouter {
    fun applyResolvedEnvironment(environment: String)

    fun resetToBaseEnvironment()
}

object NoOpSessionEnvironmentRouter : SessionEnvironmentRouter {
    override fun applyResolvedEnvironment(environment: String) = Unit

    override fun resetToBaseEnvironment() = Unit
}
