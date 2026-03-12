package com.reguerta.user.presentation.access

enum class AuthShellRoute {
    SPLASH,
    WELCOME,
    LOGIN,
    REGISTER,
    RECOVER_PASSWORD,
    HOME,
}

data class AuthShellState(
    val backStack: List<AuthShellRoute> = listOf(AuthShellRoute.SPLASH),
) {
    val currentRoute: AuthShellRoute
        get() = backStack.last()

    val canGoBack: Boolean
        get() = backStack.size > 1
}

sealed interface AuthShellAction {
    data class SplashCompleted(val isAuthenticated: Boolean) : AuthShellAction

    data object ContinueFromWelcome : AuthShellAction

    data object OpenRegisterFromLogin : AuthShellAction

    data object OpenRecoverFromLogin : AuthShellAction

    data object SessionAuthenticated : AuthShellAction

    data object SignedOut : AuthShellAction

    data object Back : AuthShellAction
}

fun reduceAuthShell(
    state: AuthShellState,
    action: AuthShellAction,
): AuthShellState =
    when (action) {
        is AuthShellAction.SplashCompleted -> {
            state.resetTo(if (action.isAuthenticated) AuthShellRoute.HOME else AuthShellRoute.WELCOME)
        }

        AuthShellAction.ContinueFromWelcome -> state.push(AuthShellRoute.LOGIN)
        AuthShellAction.OpenRegisterFromLogin -> state.push(AuthShellRoute.REGISTER)
        AuthShellAction.OpenRecoverFromLogin -> state.push(AuthShellRoute.RECOVER_PASSWORD)
        AuthShellAction.SessionAuthenticated -> state.resetTo(AuthShellRoute.HOME)
        AuthShellAction.SignedOut -> state.resetTo(AuthShellRoute.WELCOME)
        AuthShellAction.Back -> state.popOrStay()
    }

private fun AuthShellState.push(route: AuthShellRoute): AuthShellState {
    if (currentRoute == route) return this
    return copy(backStack = backStack + route)
}

private fun AuthShellState.resetTo(route: AuthShellRoute): AuthShellState =
    copy(backStack = listOf(route))

private fun AuthShellState.popOrStay(): AuthShellState {
    if (!canGoBack) return this
    return copy(backStack = backStack.dropLast(1))
}
