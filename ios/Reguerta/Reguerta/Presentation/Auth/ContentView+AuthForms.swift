import SwiftUI

extension AuthShellView {
    var signInCard: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            reguertaInputField(
                localizedKey(AccessL10nKey.emailLabel),
                text: binding(\.emailInput),
                placeholder: localizedKey(AccessL10nKey.inputPlaceholderTapToType),
                errorMessage: sessionViewModel.emailErrorKey.map(localizedKey),
                liveValidationMessage: localizedKey(AccessL10nKey.feedbackEmailInvalid),
                liveValidation: { isValidAccessEmail(normalizeAccessEmail($0)) },
                isEnabled: !sessionViewModel.isAuthenticating,
                showsClearAction: true,
                keyboardType: .emailAddress,
                accessibilityIdentifier: "auth.login.emailField"
            )

            reguertaInputField(
                localizedKey(AccessL10nKey.passwordLabel),
                text: binding(\.passwordInput),
                placeholder: localizedKey(AccessL10nKey.inputPlaceholderTapToType),
                errorMessage: sessionViewModel.passwordErrorKey.map(localizedKey),
                liveValidationMessage: localizedKey(AccessL10nKey.authErrorWeakPassword),
                liveValidation: { isValidAccessPassword($0) },
                isEnabled: !sessionViewModel.isAuthenticating,
                isSecure: true,
                showsPasswordToggle: true,
                keyboardType: .default,
                accessibilityIdentifier: "auth.login.passwordField"
            )

            HStack {
                Spacer()
                Button {
                    rootViewModel.dispatchShell(.openRecoverFromLogin)
                } label: {
                    Text(localizedKey(AccessL10nKey.loginLinkForgotPassword))
                        .font(tokens.button.textFont)
                        .foregroundStyle(tokens.colors.actionPrimary)
                }
                .buttonStyle(.plain)
                .frame(minHeight: tokens.layout.minimumTouchTarget)
            }
            .padding(.top, tokens.spacing.xs)

            Spacer(minLength: tokens.spacing.xxl * 3)

            reguertaButton(
                localizedKey(sessionViewModel.isAuthenticating ? AccessL10nKey.signingIn : AccessL10nKey.signIn),
                isEnabled: sessionViewModel.canSubmitSignIn,
                isLoading: sessionViewModel.isAuthenticating,
                accessibilityIdentifier: "auth.login.signInButton"
            ) {
                sessionViewModel.signIn()
            }
        }
    }

    var signUpCard: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            reguertaInputField(
                localizedKey(AccessL10nKey.emailLabel),
                text: binding(\.registerEmailInput),
                placeholder: localizedKey(AccessL10nKey.inputPlaceholderTapToType),
                errorMessage: sessionViewModel.registerEmailErrorKey.map(localizedKey),
                liveValidationMessage: localizedKey(AccessL10nKey.feedbackEmailInvalid),
                liveValidation: { isValidAccessEmail(normalizeAccessEmail($0)) },
                isEnabled: !sessionViewModel.isRegistering,
                showsClearAction: true,
                keyboardType: .emailAddress
            )

            reguertaInputField(
                localizedKey(AccessL10nKey.passwordLabel),
                text: binding(\.registerPasswordInput),
                placeholder: localizedKey(AccessL10nKey.inputPlaceholderTapToType),
                errorMessage: sessionViewModel.registerPasswordErrorKey.map(localizedKey),
                liveValidationMessage: localizedKey(AccessL10nKey.authErrorWeakPassword),
                liveValidation: { isValidAccessPassword($0) },
                isEnabled: !sessionViewModel.isRegistering,
                isSecure: true,
                sharedPasswordVisibility: rootBinding(\.areRegisterPasswordsVisible),
                showsPasswordToggle: true,
                keyboardType: .default
            )

            reguertaInputField(
                localizedKey(AccessL10nKey.registerRepeatPasswordLabel),
                text: binding(\.registerRepeatPasswordInput),
                placeholder: localizedKey(AccessL10nKey.inputPlaceholderTapToType),
                errorMessage: sessionViewModel.registerRepeatPasswordErrorKey.map(localizedKey),
                liveValidationMessageProvider: { repeatedPassword in
                    if repeatedPassword.isEmpty {
                        return localizedKey(AccessL10nKey.feedbackPasswordRepeatRequired)
                    }
                    if !isValidAccessPassword(repeatedPassword) {
                        return localizedKey(AccessL10nKey.authErrorWeakPassword)
                    }
                    if repeatedPassword != sessionViewModel.registerPasswordInput {
                        return localizedKey(AccessL10nKey.feedbackPasswordMismatch)
                    }
                    return nil
                },
                isEnabled: !sessionViewModel.isRegistering,
                isSecure: true,
                sharedPasswordVisibility: rootBinding(\.areRegisterPasswordsVisible),
                showsPasswordToggle: true,
                keyboardType: .default
            )

            Spacer(minLength: tokens.spacing.xxl * 3)

            reguertaButton(
                localizedKey(
                    sessionViewModel.isRegistering
                        ? AccessL10nKey.registerActionCreating
                        : AccessL10nKey.registerActionCreateAccount
                ),
                isEnabled: sessionViewModel.canSubmitSignUp,
                isLoading: sessionViewModel.isRegistering
            ) {
                sessionViewModel.signUp()
            }
        }
    }

    var recoverPasswordCard: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            reguertaInputField(
                localizedKey(AccessL10nKey.emailLabel),
                text: binding(\.recoverEmailInput),
                placeholder: localizedKey(AccessL10nKey.inputPlaceholderTapToType),
                errorMessage: sessionViewModel.recoverEmailErrorKey.map(localizedKey),
                liveValidationMessage: localizedKey(AccessL10nKey.feedbackEmailInvalid),
                liveValidation: { isValidAccessEmail(normalizeAccessEmail($0)) },
                isEnabled: !sessionViewModel.isRecoveringPassword,
                showsClearAction: true,
                keyboardType: .emailAddress
            )

            Spacer(minLength: tokens.spacing.xxl * 3 + tokens.spacing.lg)

            reguertaButton(
                localizedKey(
                    sessionViewModel.isRecoveringPassword
                        ? AccessL10nKey.recoverActionSending
                        : AccessL10nKey.recoverActionSendEmail
                ),
                isEnabled: sessionViewModel.canSubmitPasswordReset,
                isLoading: sessionViewModel.isRecoveringPassword
            ) {
                sessionViewModel.sendPasswordReset()
            }
        }
    }

}
