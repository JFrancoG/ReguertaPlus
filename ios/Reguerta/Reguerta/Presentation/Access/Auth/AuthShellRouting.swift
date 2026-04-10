import Foundation

enum AuthShellRoute: String, Equatable, Hashable, Sendable {
    case splash
    case welcome
    case login
    case register
    case recoverPassword
    case home
}

struct AuthShellState: Equatable, Sendable {
    var backStack: [AuthShellRoute] = [.splash]

    var currentRoute: AuthShellRoute {
        backStack.last ?? .splash
    }

    var canGoBack: Bool {
        backStack.count > 1
    }
}

enum AuthShellAction: Equatable, Sendable {
    case splashCompleted(isAuthenticated: Bool)
    case continueFromWelcome
    case reauthenticate
    case openRegisterFromWelcome
    case openRegisterFromLogin
    case openRecoverFromLogin
    case sessionAuthenticated
    case signedOut
    case back
}

func reduceAuthShell(state: AuthShellState, action: AuthShellAction) -> AuthShellState {
    switch action {
    case .splashCompleted(let isAuthenticated):
        return state.resetTo(isAuthenticated ? .home : .welcome)
    case .continueFromWelcome:
        return state.push(.login)
    case .reauthenticate:
        return state.resetTo([.welcome, .login])
    case .openRegisterFromWelcome:
        return state.push(.register)
    case .openRegisterFromLogin:
        return state.push(.register)
    case .openRecoverFromLogin:
        return state.push(.recoverPassword)
    case .sessionAuthenticated:
        return state.resetTo(.home)
    case .signedOut:
        return state.resetTo(.welcome)
    case .back:
        return state.popOrStay()
    }
}

private extension AuthShellState {
    func push(_ route: AuthShellRoute) -> AuthShellState {
        guard currentRoute != route else { return self }
        return AuthShellState(backStack: backStack + [route])
    }

    func resetTo(_ route: AuthShellRoute) -> AuthShellState {
        AuthShellState(backStack: [route])
    }

    func resetTo(_ routes: [AuthShellRoute]) -> AuthShellState {
        AuthShellState(backStack: routes)
    }

    func popOrStay() -> AuthShellState {
        guard canGoBack else { return self }
        return AuthShellState(backStack: Array(backStack.dropLast()))
    }
}
