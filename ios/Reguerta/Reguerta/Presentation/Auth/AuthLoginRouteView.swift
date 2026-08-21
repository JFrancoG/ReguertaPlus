import SwiftUI

struct AuthLoginRouteView: View {
    @Binding var email: String
    @Binding var password: String

    let emailErrorKey: String?
    let passwordErrorKey: String?
    let isLoading: Bool
    let canSubmit: Bool
    let tokens: ReguertaDesignTokens
    let onBack: () -> Void
    let onOpenRecovery: () -> Void
    let onSubmit: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            ReguertaScreenHeaderView(
                configuration: ReguertaScreenHeaderConfiguration(
                    title: .localized(AccessL10nKey.loginTitle),
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
                    accessibilityIdentifier: "auth.login.emailField"
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
                    showsPasswordToggle: true,
                    keyboardType: .default,
                    textContentType: .password,
                    accessibilityIdentifier: "auth.login.passwordField"
                )

                HStack {
                    Spacer()
                    Button {
                        onOpenRecovery()
                    } label: {
                        Text(LocalizedStringKey(AccessL10nKey.loginLinkForgotPassword))
                            .font(tokens.button.textFont)
                            .foregroundStyle(tokens.colors.actionPrimary)
                    }
                    .buttonStyle(.plain)
                    .frame(minHeight: tokens.layout.minimumTouchTarget)
                    .accessibilityIdentifier("auth.login.recoverPasswordButton")
                }
                .padding(.top, tokens.spacing.xs)

                Spacer(minLength: tokens.spacing.xxl * 3)

                reguertaButton(
                    LocalizedStringKey(isLoading ? AccessL10nKey.signingIn : AccessL10nKey.signIn),
                    isEnabled: canSubmit,
                    isLoading: isLoading,
                    accessibilityIdentifier: "auth.login.signInButton"
                ) {
                    onSubmit()
                }
            }
        }
    }
}

#Preview(
    "Login · normal · 320 · ES light · Large",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 320, height: 640)
) {
    @Previewable @State var email = "member@example.com"
    @Previewable @State var password = "secret12"

    AuthLoginRouteView(
        email: $email,
        password: $password,
        emailErrorKey: nil,
        passwordErrorKey: nil,
        isLoading: false,
        canSubmit: true,
        tokens: .light
    ) {
    } onOpenRecovery: {
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
    "Login · loading · 393 · EN dark · XXX Large",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 393, height: 852)
) {
    @Previewable @State var email = "member@example.com"
    @Previewable @State var password = "secret12"

    AuthLoginRouteView(
        email: $email,
        password: $password,
        emailErrorKey: nil,
        passwordErrorKey: nil,
        isLoading: true,
        canSubmit: false,
        tokens: .dark
    ) {
    } onOpenRecovery: {
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
    "Login · validation error · AX5 · Reduce Motion · external Increased Contrast override",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 320, height: 720)
) {
    @Previewable @State var email = "invalid"
    @Previewable @State var password = "123"

    AuthLoginRouteView(
        email: $email,
        password: $password,
        emailErrorKey: AccessL10nKey.feedbackEmailInvalid,
        passwordErrorKey: AccessL10nKey.authErrorWeakPassword,
        isLoading: false,
        canSubmit: false,
        tokens: .dark
    ) {
    } onOpenRecovery: {
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

#Preview(
    "Login · draining · 393 · EN dark · XXX Large",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 393, height: 852)
) {
    @Previewable @State var email = "member@example.com"
    @Previewable @State var password = "secret12"

    AuthLoginRouteView(
        email: $email,
        password: $password,
        emailErrorKey: nil,
        passwordErrorKey: nil,
        isLoading: false,
        canSubmit: false,
        tokens: .dark
    ) {
    } onOpenRecovery: {
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
