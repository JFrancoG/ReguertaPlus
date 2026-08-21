import SwiftUI

struct AuthRecoverPasswordRouteView: View {
    @Binding var email: String

    let emailErrorKey: String?
    let isLoading: Bool
    let canSubmit: Bool
    let tokens: ReguertaDesignTokens
    let onBack: () -> Void
    let onSubmit: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            ReguertaScreenHeaderView(
                configuration: ReguertaScreenHeaderConfiguration(
                    title: .localized(AccessL10nKey.recoverTitle),
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
                    textContentType: .emailAddress,
                    accessibilityIdentifier: "auth.recoverPassword.emailField"
                )

                Spacer(minLength: tokens.spacing.xxl * 3 + tokens.spacing.lg)

                reguertaButton(
                    LocalizedStringKey(
                        isLoading
                            ? AccessL10nKey.recoverActionSending
                            : AccessL10nKey.recoverActionSendEmail
                    ),
                    isEnabled: canSubmit,
                    isLoading: isLoading,
                    accessibilityIdentifier: "auth.recoverPassword.sendEmailButton"
                ) {
                    onSubmit()
                }
            }
        }
    }
}

#Preview(
    "Recover password · normal · 320 · ES light · Large",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 320, height: 640)
) {
    @Previewable @State var email = "member@example.com"

    AuthRecoverPasswordRouteView(
        email: $email,
        emailErrorKey: nil,
        isLoading: false,
        canSubmit: true,
        tokens: .light
    ) {
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
    "Recover password · loading · 393 · EN dark · XXX Large",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 393, height: 852)
) {
    @Previewable @State var email = "member@example.com"

    AuthRecoverPasswordRouteView(
        email: $email,
        emailErrorKey: nil,
        isLoading: true,
        canSubmit: false,
        tokens: .dark
    ) {
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
    "Recover password · invalid · AX5 · Reduce Motion · external Increased Contrast override",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 320, height: 720)
) {
    @Previewable @State var email = "invalid"

    AuthRecoverPasswordRouteView(
        email: $email,
        emailErrorKey: AccessL10nKey.feedbackEmailInvalid,
        isLoading: false,
        canSubmit: false,
        tokens: .dark
    ) {
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
