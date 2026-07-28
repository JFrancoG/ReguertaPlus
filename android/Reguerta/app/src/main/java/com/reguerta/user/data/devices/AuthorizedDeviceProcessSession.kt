package com.reguerta.user.data.devices

import java.util.concurrent.atomic.AtomicReference

internal enum class AuthorizedDeviceProcessSessionMatch {
    NOT_ESTABLISHED,
    CURRENT,
    SUPERSEDED,
}

internal interface AuthorizedDeviceProcessSession {
    fun activationGeneration(): Long

    fun activate(
        context: AuthorizedDeviceSessionContext,
        expectedGeneration: Long,
    ): Boolean

    fun invalidate()

    fun invalidateIfOwned(context: AuthorizedDeviceSessionContext)

    fun match(context: AuthorizedDeviceSessionContext): AuthorizedDeviceProcessSessionMatch
}

internal object ReguertaAuthorizedDeviceProcessSession : AuthorizedDeviceProcessSession {
    private data class State(
        val generation: Long,
        val activeContext: AuthorizedDeviceSessionContext?,
    )

    private val state = AtomicReference(
        State(generation = 0L, activeContext = null),
    )

    override fun activationGeneration(): Long = state.get().generation

    override fun activate(
        context: AuthorizedDeviceSessionContext,
        expectedGeneration: Long,
    ): Boolean {
        while (true) {
            val currentState = state.get()
            if (currentState.generation != expectedGeneration) return false
            if (state.compareAndSet(currentState, currentState.copy(activeContext = context))) {
                return true
            }
        }
    }

    override fun invalidate() {
        while (true) {
            val currentState = state.get()
            val invalidatedState = State(
                generation = currentState.generation + 1L,
                activeContext = null,
            )
            if (state.compareAndSet(currentState, invalidatedState)) return
        }
    }

    override fun invalidateIfOwned(context: AuthorizedDeviceSessionContext) {
        while (true) {
            val currentState = state.get()
            if (currentState.activeContext != context) return
            if (state.compareAndSet(currentState, currentState.copy(activeContext = null))) return
        }
    }

    override fun match(
        context: AuthorizedDeviceSessionContext,
    ): AuthorizedDeviceProcessSessionMatch {
        val currentContext = state.get().activeContext
            ?: return AuthorizedDeviceProcessSessionMatch.NOT_ESTABLISHED
        return if (currentContext == context) {
            AuthorizedDeviceProcessSessionMatch.CURRENT
        } else {
            AuthorizedDeviceProcessSessionMatch.SUPERSEDED
        }
    }
}
