package com.reguerta.user.presentation.shiftcoverage

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.reguerta.user.domain.shiftcoverage.CoverageRehearsalAccess
import kotlinx.coroutines.launch

/** Local Auth owner used only by the isolated Debug rehearsal. */
internal class CoverageRehearsalViewModel(private val access: CoverageRehearsalAccess) : CoverageRouteViewModel(access.repository) {
    override val isRehearsal: Boolean get() = true
    override val authenticationInFlight: Boolean get() = isSigningIn
    var email by mutableStateOf("")
    var password by mutableStateOf("")
    var isSigningIn by mutableStateOf(false)
        private set
    var loginFailed by mutableStateOf(false)
        private set
    private var loginGeneration = 0L
    val canSignIn: Boolean get() = !isSigningIn && email.isNotBlank() && password.isNotEmpty()

    fun signIn() {
        if (!canSignIn) return
        val owner = ++loginGeneration
        val secret = password
        password = ""
        isSigningIn = true
        loginFailed = false
        routeScope.launch {
            try {
                val session = access.signIn(email.trim(), secret)
                if (owner != loginGeneration) return@launch
                bindSession(session, preservePendingPush = true)
                coverage.refresh()
            } catch (_: Exception) {
                if (owner == loginGeneration) loginFailed = true
            } finally {
                if (owner == loginGeneration) isSigningIn = false
            }
        }
    }

    fun signOut() {
        loginGeneration++
        access.signOut()
        bindSession(null)
        password = ""
        isSigningIn = false
        loginFailed = false
    }

    override fun onCleared() { signOut(); super.onCleared() }
}
