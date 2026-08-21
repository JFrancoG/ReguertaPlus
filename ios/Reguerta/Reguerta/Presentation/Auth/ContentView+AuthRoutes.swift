import SwiftUI

extension AuthShellView {
    @ViewBuilder
    var currentAuthRoute: some View {
        switch rootViewModel.shellState.currentRoute {
        case .welcome:
            AuthWelcomeRouteView(tokens: tokens) {
                rootViewModel.dispatchShell(.continueFromWelcome)
            } onOpenRegistration: {
                rootViewModel.dispatchShell(.openRegisterFromWelcome)
            }
        case .login:
            AuthLoginRouteView(
                email: $sessionViewModel.emailInput,
                password: $sessionViewModel.passwordInput,
                emailErrorKey: sessionViewModel.emailErrorKey,
                passwordErrorKey: sessionViewModel.passwordErrorKey,
                isLoading: sessionViewModel.isAuthenticating,
                canSubmit: sessionViewModel.canSubmitSignIn,
                tokens: tokens
            ) {
                rootViewModel.dispatchShell(.back)
            } onOpenRecovery: {
                rootViewModel.dispatchShell(.openRecoverFromLogin)
            } onSubmit: {
                sessionViewModel.signIn()
            }
        case .register:
            AuthRegisterRouteView(
                email: $sessionViewModel.registerEmailInput,
                password: $sessionViewModel.registerPasswordInput,
                repeatedPassword: $sessionViewModel.registerRepeatPasswordInput,
                passwordsVisible: $rootViewModel.areRegisterPasswordsVisible,
                emailErrorKey: sessionViewModel.registerEmailErrorKey,
                passwordErrorKey: sessionViewModel.registerPasswordErrorKey,
                repeatedPasswordErrorKey: sessionViewModel.registerRepeatPasswordErrorKey,
                isLoading: sessionViewModel.isRegistering,
                canSubmit: sessionViewModel.canSubmitSignUp,
                tokens: tokens
            ) { candidate in
                sessionViewModel.registerRepeatedPasswordValidationMessage(candidate)
                    .map { LocalizedStringKey($0) }
            } onBack: {
                rootViewModel.dispatchShell(.back)
            } onSubmit: {
                sessionViewModel.signUp()
            }
        case .recoverPassword:
            AuthRecoverPasswordRouteView(
                email: $sessionViewModel.recoverEmailInput,
                emailErrorKey: sessionViewModel.recoverEmailErrorKey,
                isLoading: sessionViewModel.isRecoveringPassword,
                canSubmit: sessionViewModel.canSubmitPasswordReset,
                tokens: tokens
            ) {
                rootViewModel.dispatchShell(.back)
            } onSubmit: {
                sessionViewModel.sendPasswordReset()
            }
        case .splash, .home:
            EmptyView()
        }
    }
}
