import SwiftUI

struct AuthRegisterRouteView: View {
    @Binding var email: String
    @Binding var password: String
    @Binding var repeatedPassword: String
    @Binding var passwordsVisible: Bool

    let emailErrorKey: String?
    let passwordErrorKey: String?
    let repeatedPasswordErrorKey: String?
    let isLoading: Bool
    let canSubmit: Bool
    let tokens: ReguertaDesignTokens
    let repeatedPasswordValidationMessage: (String) -> LocalizedStringKey?
    let onBack: () -> Void
    let onSubmit: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            ReguertaScreenHeaderView(
                configuration: ReguertaScreenHeaderConfiguration(
                    title: .localized(AccessL10nKey.registerTitle),
                    leadingAction: ReguertaHeaderAction(
                        systemImageName: "chevron.left",
                        accessibilityLabel: .localized(AccessL10nKey.commonBack),
                        accessibilityIdentifier: "auth.header.backButton"
                    ) {
                        onBack()
                    }
                )
            )

            VStack(alignment: .leading, spacing: tokens.spacing.lg) {
                reguertaInputField(
                    LocalizedStringKey(AccessL10nKey.emailLabel),
                    text: $email,
                    placeholder: LocalizedStringKey(AccessL10nKey.inputPlaceholderTapToType),
                    errorMessage: emailErrorKey.map { LocalizedStringKey($0) },
                    liveValidationMessage: LocalizedStringKey(AccessL10nKey.feedbackEmailInvalid),
                    liveValidation: isValidNormalizedAccessEmailInput,
                    isEnabled: !isLoading,
                    showsClearAction: true,
                    keyboardType: .emailAddress,
                    textContentType: .username,
                    accessibilityIdentifier: "auth.register.emailField"
                )

                reguertaInputField(
                    LocalizedStringKey(AccessL10nKey.passwordLabel),
                    text: $password,
                    placeholder: LocalizedStringKey(AccessL10nKey.inputPlaceholderTapToType),
                    errorMessage: passwordErrorKey.map { LocalizedStringKey($0) },
                    liveValidationMessage: LocalizedStringKey(AccessL10nKey.authErrorWeakPassword),
                    liveValidation: isValidAccessPassword,
                    isEnabled: !isLoading,
                    isSecure: true,
                    sharedPasswordVisibility: $passwordsVisible,
                    showsPasswordToggle: true,
                    keyboardType: .default,
                    textContentType: .newPassword,
                    accessibilityIdentifier: "auth.register.passwordField"
                )

                reguertaInputField(
                    LocalizedStringKey(AccessL10nKey.registerRepeatPasswordLabel),
                    text: $repeatedPassword,
                    placeholder: LocalizedStringKey(AccessL10nKey.inputPlaceholderTapToType),
                    errorMessage: repeatedPasswordErrorKey.map { LocalizedStringKey($0) },
                    liveValidationMessageProvider: repeatedPasswordValidationMessage,
                    isEnabled: !isLoading,
                    isSecure: true,
                    sharedPasswordVisibility: $passwordsVisible,
                    showsPasswordToggle: true,
                    keyboardType: .default,
                    textContentType: .newPassword,
                    accessibilityIdentifier: "auth.register.repeatPasswordField"
                )

                Spacer(minLength: tokens.spacing.xxl * 3)

                reguertaButton(
                    LocalizedStringKey(
                        isLoading
                            ? AccessL10nKey.registerActionCreating
                            : AccessL10nKey.registerActionCreateAccount
                    ),
                    isEnabled: canSubmit,
                    isLoading: isLoading,
                    accessibilityIdentifier: "auth.register.createAccountButton"
                ) {
                    onSubmit()
                }
            }
        }
    }
}

#Preview(
    "Register · normal · 320 · ES light · Large",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 320, height: 640)
) {
    @Previewable @State var email = "member@example.com"
    @Previewable @State var password = "secret12"
    @Previewable @State var repeatedPassword = "secret12"
    @Previewable @State var passwordsVisible = false

    AuthRegisterRouteView(
        email: $email,
        password: $password,
        repeatedPassword: $repeatedPassword,
        passwordsVisible: $passwordsVisible,
        emailErrorKey: nil,
        passwordErrorKey: nil,
        repeatedPasswordErrorKey: nil,
        isLoading: false,
        canSubmit: true,
        tokens: .light
    ) { _ in
        nil
    } onBack: {
    } onSubmit: {
    }
    .reguertaAuthRoutePreviewSurface(tokens: .light)
    .reguertaPreviewTheme(
        tokens: .light,
        motionPolicy: ReguertaMotionPolicy(reducesMotion: false)
    )
    .environment(\.locale, Locale(identifier: "es"))
    .environment(\.dynamicTypeSize, .large)
    .preferredColorScheme(.light)
}

#Preview(
    "Register · loading · 393 · EN dark · XXX Large",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 393, height: 852)
) {
    @Previewable @State var email = "member@example.com"
    @Previewable @State var password = "secret12"
    @Previewable @State var repeatedPassword = "secret12"
    @Previewable @State var passwordsVisible = false

    AuthRegisterRouteView(
        email: $email,
        password: $password,
        repeatedPassword: $repeatedPassword,
        passwordsVisible: $passwordsVisible,
        emailErrorKey: nil,
        passwordErrorKey: nil,
        repeatedPasswordErrorKey: nil,
        isLoading: true,
        canSubmit: false,
        tokens: .dark
    ) { _ in
        nil
    } onBack: {
    } onSubmit: {
    }
    .reguertaAuthRoutePreviewSurface(tokens: .dark)
    .reguertaPreviewTheme(
        tokens: .dark,
        motionPolicy: ReguertaMotionPolicy(reducesMotion: false)
    )
    .environment(\.locale, Locale(identifier: "en"))
    .environment(\.dynamicTypeSize, .xxxLarge)
    .preferredColorScheme(.dark)
}

#Preview(
    "Register · mismatch · AX5 · Reduce Motion · external Increased Contrast override",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 320, height: 720)
) {
    @Previewable @State var email = "member@example.com"
    @Previewable @State var password = "secret12"
    @Previewable @State var repeatedPassword = "different"
    @Previewable @State var passwordsVisible = true

    AuthRegisterRouteView(
        email: $email,
        password: $password,
        repeatedPassword: $repeatedPassword,
        passwordsVisible: $passwordsVisible,
        emailErrorKey: nil,
        passwordErrorKey: nil,
        repeatedPasswordErrorKey: AccessL10nKey.feedbackPasswordMismatch,
        isLoading: false,
        canSubmit: false,
        tokens: .dark
    ) { _ in
        LocalizedStringKey(AccessL10nKey.feedbackPasswordMismatch)
    } onBack: {
    } onSubmit: {
    }
    .reguertaAuthRoutePreviewSurface(tokens: .dark)
    .reguertaPreviewTheme(
        tokens: .dark,
        motionPolicy: ReguertaMotionPolicy(reducesMotion: true)
    )
    .environment(\.locale, Locale(identifier: "en"))
    .environment(\.dynamicTypeSize, .accessibility5)
    .preferredColorScheme(.dark)
}
