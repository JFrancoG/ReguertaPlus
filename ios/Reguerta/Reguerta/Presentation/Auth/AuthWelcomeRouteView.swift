import SwiftUI

private enum AuthWelcomeLayout {
    static let logoSize: CGFloat = 214
    static let maximumActionWidth: CGFloat = 320
}

struct AuthWelcomeRouteView: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    let tokens: ReguertaDesignTokens
    let onContinue: () -> Void
    let onOpenRegistration: () -> Void

    var body: some View {
        VStack(spacing: tokens.spacing.md) {
            Spacer().frame(height: tokens.spacing.xxl + tokens.spacing.sm)

            VStack(spacing: tokens.spacing.md) {
                Text(LocalizedStringKey(AccessL10nKey.welcomeTitlePrefix))
                    .font(tokens.typography.titleDialog)
                    .foregroundStyle(tokens.colors.textPrimary)
                    .frame(maxWidth: .infinity)

                Text(LocalizedStringKey(AccessL10nKey.welcomeTitleBrand))
                    .font(tokens.typography.titleHero)
                    .foregroundStyle(tokens.colors.actionPrimary)
                    .frame(maxWidth: .infinity)
            }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)

            Spacer()

            Image("brand_logo")
                .resizable()
                .scaledToFit()
                .frame(width: AuthWelcomeLayout.logoSize, height: AuthWelcomeLayout.logoSize)
                .frame(maxWidth: .infinity)
                .accessibilityHidden(true)

            Spacer()

            reguertaButton(
                LocalizedStringKey(AccessL10nKey.welcomeCtaEnter),
                fullWidth: true,
                accessibilityIdentifier: "auth.welcome.enterButton"
            ) {
                onContinue()
            }
            .frame(maxWidth: AuthWelcomeLayout.maximumActionWidth)
            .frame(maxWidth: .infinity)

            Spacer()

            registrationPromptLayout {
                Text(LocalizedStringKey(AccessL10nKey.welcomeNotRegistered))
                    .font(tokens.typography.titleCard)
                    .foregroundStyle(tokens.colors.textSecondary)
                Button {
                    onOpenRegistration()
                } label: {
                    Text(LocalizedStringKey(AccessL10nKey.welcomeLinkRegister))
                        .font(tokens.typography.titleCard)
                        .foregroundStyle(tokens.colors.actionPrimary)
                }
                .buttonStyle(.plain)
                .frame(minHeight: tokens.layout.minimumTouchTarget)
                .accessibilityIdentifier("auth.welcome.registerButton")
            }
            .frame(maxWidth: .infinity)
            .padding(.bottom, tokens.spacing.sm)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private var registrationPromptLayout: AnyLayout {
        dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(spacing: tokens.spacing.xs))
            : AnyLayout(HStackLayout(spacing: tokens.spacing.xs))
    }
}

#Preview(
    "Welcome · 320 · ES light · Large",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 320, height: 640)
) {
    AuthWelcomeRouteView(tokens: .light) {
    } onOpenRegistration: {
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
    "Welcome · 393 · EN dark · XXX Large",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 393, height: 852)
) {
    AuthWelcomeRouteView(tokens: .dark) {
    } onOpenRegistration: {
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
    "Welcome · AX5 · Reduce Motion · external Increased Contrast override",
    traits: .modifier(ReguertaDesignSystemPreviewModifier()),
    .fixedLayout(width: 320, height: 720)
) {
    AuthWelcomeRouteView(tokens: .dark) {
    } onOpenRegistration: {
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
