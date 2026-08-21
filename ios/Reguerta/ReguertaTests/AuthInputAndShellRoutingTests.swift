import Testing

@testable import Reguerta

struct AuthInputAndShellRoutingTests {
    @Test(
        "Access emails are trimmed and lowercased",
        arguments: [
            ("  ANA.Admin+News@Reguerta.APP \n", "ana.admin+news@reguerta.app"),
            ("\tMEMBER@EXAMPLE.COM\r\n", "member@example.com"),
            ("already.normalized@example.org", "already.normalized@example.org")
        ]
    )
    func accessEmailNormalization(rawEmail: String, expectedEmail: String) {
        #expect(normalizeAccessEmail(rawEmail) == expectedEmail)
    }

    @Test(
        "Valid access emails are accepted after normalization",
        arguments: [
            "member@reguerta.app",
            " ANA.ADMIN@REGUERTA.APP ",
            "producer+orders@example.co.uk",
            "first_last-2@example-domain.org"
        ]
    )
    func validAccessEmails(rawEmail: String) {
        #expect(isValidAccessEmail(normalizeAccessEmail(rawEmail)))
    }

    @Test(
        "Malformed access emails remain invalid after normalization",
        arguments: [
            "",
            "member",
            "@reguerta.app",
            "member@",
            "member@reguerta",
            "member@reguerta.c",
            "member @reguerta.app",
            "member@reguerta .app",
            "member@reguerta.app extra"
        ]
    )
    func invalidAccessEmails(rawEmail: String) {
        #expect(!isValidAccessEmail(normalizeAccessEmail(rawEmail)))
    }

    @Test(
        "Access passwords include both documented length boundaries",
        arguments: [
            (5, false),
            (6, true),
            (16, true),
            (17, false)
        ]
    )
    func accessPasswordLengthBoundaries(length: Int, expectedValidity: Bool) {
        #expect(isValidAccessPassword(String(repeating: "x", count: length)) == expectedValidity)
    }

    @Test(
        "Shell actions reset, push, pop at root, and deduplicate deterministically",
        arguments: [
            (
                AuthShellState(backStack: [.splash]),
                AuthShellAction.splashCompleted(isAuthenticated: false),
                [AuthShellRoute.welcome]
            ),
            (
                AuthShellState(backStack: [.splash]),
                AuthShellAction.splashCompleted(isAuthenticated: true),
                [AuthShellRoute.home]
            ),
            (
                AuthShellState(backStack: [.home]),
                AuthShellAction.reauthenticate,
                [AuthShellRoute.welcome, .login]
            ),
            (
                AuthShellState(backStack: [.welcome, .register]),
                AuthShellAction.reauthenticate,
                [AuthShellRoute.welcome, .login]
            ),
            (
                AuthShellState(backStack: [.welcome, .login, .recoverPassword]),
                AuthShellAction.sessionAuthenticated,
                [AuthShellRoute.home]
            ),
            (
                AuthShellState(backStack: [.home]),
                AuthShellAction.signedOut,
                [AuthShellRoute.welcome]
            ),
            (
                AuthShellState(backStack: [.welcome, .login]),
                AuthShellAction.openRecoverFromLogin,
                [AuthShellRoute.welcome, .login, .recoverPassword]
            ),
            (
                AuthShellState(backStack: [.welcome, .login, .recoverPassword]),
                AuthShellAction.back,
                [AuthShellRoute.welcome, .login]
            ),
            (
                AuthShellState(backStack: [.welcome]),
                AuthShellAction.back,
                [AuthShellRoute.welcome]
            ),
            (
                AuthShellState(backStack: [.splash]),
                AuthShellAction.back,
                [AuthShellRoute.splash]
            ),
            (
                AuthShellState(backStack: [.welcome, .login, .recoverPassword]),
                AuthShellAction.openRecoverFromLogin,
                [AuthShellRoute.welcome, .login, .recoverPassword]
            ),
            (
                AuthShellState(backStack: [.welcome, .login]),
                AuthShellAction.continueFromWelcome,
                [AuthShellRoute.welcome, .login]
            )
        ]
    )
    func authShellActionTable(
        initialState: AuthShellState,
        action: AuthShellAction,
        expectedBackStack: [AuthShellRoute]
    ) {
        #expect(reduceAuthShell(state: initialState, action: action).backStack == expectedBackStack)
    }
}
