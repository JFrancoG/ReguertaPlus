import SwiftUI

extension AccessRootRoutingView {
    var signInCard: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            reguertaInputField(
                localizedKey(AccessL10nKey.emailLabel),
                text: binding(\.emailInput),
                placeholder: localizedKey(AccessL10nKey.inputPlaceholderTapToType),
                errorMessage: viewModel.emailErrorKey.map(localizedKey),
                liveValidationMessage: localizedKey(AccessL10nKey.feedbackEmailInvalid),
                liveValidation: { isValidAccessEmail(normalizeAccessEmail($0)) },
                isEnabled: !viewModel.isAuthenticating,
                showsClearAction: true,
                keyboardType: .emailAddress,
                accessibilityIdentifier: "auth.login.emailField"
            )

            reguertaInputField(
                localizedKey(AccessL10nKey.passwordLabel),
                text: binding(\.passwordInput),
                placeholder: localizedKey(AccessL10nKey.inputPlaceholderTapToType),
                errorMessage: viewModel.passwordErrorKey.map(localizedKey),
                liveValidationMessage: localizedKey(AccessL10nKey.authErrorWeakPassword),
                liveValidation: { isValidAccessPassword($0) },
                isEnabled: !viewModel.isAuthenticating,
                isSecure: true,
                showsPasswordToggle: true,
                keyboardType: .default,
                accessibilityIdentifier: "auth.login.passwordField"
            )

            HStack {
                Spacer()
                Button {
                    dispatchShell(.openRecoverFromLogin)
                } label: {
                    Text(localizedKey(AccessL10nKey.loginLinkForgotPassword))
                        .font(tokens.button.textFont)
                        .foregroundStyle(tokens.colors.actionPrimary)
                }
                .buttonStyle(.plain)
            }
            .padding(.top, tokens.spacing.xs)

            Spacer(minLength: 72.resize)

            reguertaButton(
                localizedKey(viewModel.isAuthenticating ? AccessL10nKey.signingIn : AccessL10nKey.signIn),
                isEnabled: viewModel.canSubmitSignIn,
                isLoading: viewModel.isAuthenticating,
                accessibilityIdentifier: "auth.login.signInButton"
            ) {
                viewModel.signIn()
            }
        }
    }

    var signUpCard: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            reguertaInputField(
                localizedKey(AccessL10nKey.emailLabel),
                text: binding(\.registerEmailInput),
                placeholder: localizedKey(AccessL10nKey.inputPlaceholderTapToType),
                errorMessage: viewModel.registerEmailErrorKey.map(localizedKey),
                liveValidationMessage: localizedKey(AccessL10nKey.feedbackEmailInvalid),
                liveValidation: { isValidAccessEmail(normalizeAccessEmail($0)) },
                isEnabled: !viewModel.isRegistering,
                showsClearAction: true,
                keyboardType: .emailAddress
            )

            reguertaInputField(
                localizedKey(AccessL10nKey.passwordLabel),
                text: binding(\.registerPasswordInput),
                placeholder: localizedKey(AccessL10nKey.inputPlaceholderTapToType),
                errorMessage: viewModel.registerPasswordErrorKey.map(localizedKey),
                liveValidationMessage: localizedKey(AccessL10nKey.authErrorWeakPassword),
                liveValidation: { isValidAccessPassword($0) },
                isEnabled: !viewModel.isRegistering,
                isSecure: true,
                sharedPasswordVisibility: rootBinding(\.areRegisterPasswordsVisible),
                showsPasswordToggle: true,
                keyboardType: .default
            )

            reguertaInputField(
                localizedKey(AccessL10nKey.registerRepeatPasswordLabel),
                text: binding(\.registerRepeatPasswordInput),
                placeholder: localizedKey(AccessL10nKey.inputPlaceholderTapToType),
                errorMessage: viewModel.registerRepeatPasswordErrorKey.map(localizedKey),
                liveValidationMessageProvider: { repeatedPassword in
                    if repeatedPassword.isEmpty {
                        return localizedKey(AccessL10nKey.feedbackPasswordRepeatRequired)
                    }
                    if !isValidAccessPassword(repeatedPassword) {
                        return localizedKey(AccessL10nKey.authErrorWeakPassword)
                    }
                    if repeatedPassword != viewModel.registerPasswordInput {
                        return localizedKey(AccessL10nKey.feedbackPasswordMismatch)
                    }
                    return nil
                },
                isEnabled: !viewModel.isRegistering,
                isSecure: true,
                sharedPasswordVisibility: rootBinding(\.areRegisterPasswordsVisible),
                showsPasswordToggle: true,
                keyboardType: .default
            )

            Spacer(minLength: 72.resize)

            reguertaButton(
                localizedKey(viewModel.isRegistering ? AccessL10nKey.registerActionCreating : AccessL10nKey.registerActionCreateAccount),
                isEnabled: viewModel.canSubmitSignUp,
                isLoading: viewModel.isRegistering
            ) {
                viewModel.signUp()
            }
        }
    }

    var recoverPasswordCard: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            reguertaInputField(
                localizedKey(AccessL10nKey.emailLabel),
                text: binding(\.recoverEmailInput),
                placeholder: localizedKey(AccessL10nKey.inputPlaceholderTapToType),
                errorMessage: viewModel.recoverEmailErrorKey.map(localizedKey),
                liveValidationMessage: localizedKey(AccessL10nKey.feedbackEmailInvalid),
                liveValidation: { isValidAccessEmail(normalizeAccessEmail($0)) },
                isEnabled: !viewModel.isRecoveringPassword,
                showsClearAction: true,
                keyboardType: .emailAddress
            )

            Spacer(minLength: 88.resize)

            reguertaButton(
                localizedKey(viewModel.isRecoveringPassword ? AccessL10nKey.recoverActionSending : AccessL10nKey.recoverActionSendEmail),
                isEnabled: viewModel.canSubmitPasswordReset,
                isLoading: viewModel.isRecoveringPassword
            ) {
                viewModel.sendPasswordReset()
            }
        }
    }

}
