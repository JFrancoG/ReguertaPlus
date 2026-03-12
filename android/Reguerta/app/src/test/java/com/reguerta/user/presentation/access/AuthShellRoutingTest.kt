package com.reguerta.user.presentation.access

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthShellRoutingTest {
    @Test
    fun `splash routes to welcome when there is no authenticated session`() {
        val initial = AuthShellState()

        val reduced = reduceAuthShell(
            state = initial,
            action = AuthShellAction.SplashCompleted(isAuthenticated = false),
        )

        assertEquals(AuthShellRoute.WELCOME, reduced.currentRoute)
        assertFalse(reduced.canGoBack)
    }

    @Test
    fun `welcome to login to register and back keeps deterministic stack`() {
        val welcome = AuthShellState(backStack = listOf(AuthShellRoute.WELCOME))
        val login = reduceAuthShell(welcome, AuthShellAction.ContinueFromWelcome)
        val register = reduceAuthShell(login, AuthShellAction.OpenRegisterFromLogin)
        val backToLogin = reduceAuthShell(register, AuthShellAction.Back)
        val backToWelcome = reduceAuthShell(backToLogin, AuthShellAction.Back)

        assertEquals(AuthShellRoute.LOGIN, login.currentRoute)
        assertEquals(AuthShellRoute.REGISTER, register.currentRoute)
        assertEquals(AuthShellRoute.LOGIN, backToLogin.currentRoute)
        assertEquals(AuthShellRoute.WELCOME, backToWelcome.currentRoute)
    }

    @Test
    fun `session authenticated always resets to home`() {
        val fromRecover = AuthShellState(
            backStack = listOf(
                AuthShellRoute.WELCOME,
                AuthShellRoute.LOGIN,
                AuthShellRoute.RECOVER_PASSWORD,
            ),
        )

        val reduced = reduceAuthShell(fromRecover, AuthShellAction.SessionAuthenticated)

        assertEquals(AuthShellRoute.HOME, reduced.currentRoute)
        assertFalse(reduced.canGoBack)
    }

    @Test
    fun `signed out from home resets to welcome`() {
        val home = AuthShellState(backStack = listOf(AuthShellRoute.HOME))

        val reduced = reduceAuthShell(home, AuthShellAction.SignedOut)

        assertEquals(AuthShellRoute.WELCOME, reduced.currentRoute)
        assertFalse(reduced.canGoBack)
    }

    @Test
    fun `cannot go back from root route`() {
        val welcome = AuthShellState(backStack = listOf(AuthShellRoute.WELCOME))

        val reduced = reduceAuthShell(welcome, AuthShellAction.Back)

        assertEquals(AuthShellRoute.WELCOME, reduced.currentRoute)
        assertFalse(reduced.canGoBack)
        assertTrue(reduced.backStack.size == 1)
    }
}
