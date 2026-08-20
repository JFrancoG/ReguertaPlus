import SwiftUI

private enum AuthWelcomeLayout {
    static let logoSize: CGFloat = 214
    static let maximumActionWidth: CGFloat = 320
}

extension AuthShellView {
    @ViewBuilder
    var currentAuthRoute: some View {
        switch rootViewModel.shellState.currentRoute {
        case .welcome:
            welcomeRoute
        case .login:
            loginRoute
        case .register:
            registerRoute
        case .recoverPassword:
            recoverRoute
        case .splash, .home:
            EmptyView()
        }
    }

    var welcomeRoute: some View {
        VStack(spacing: tokens.spacing.md) {
            Spacer().frame(height: tokens.spacing.xxl + tokens.spacing.sm)

            Text(localizedKey(AccessL10nKey.welcomeTitlePrefix))
                .font(tokens.typography.titleDialog)
                .foregroundStyle(tokens.colors.textPrimary)
                .frame(maxWidth: .infinity)

            Text(localizedKey(AccessL10nKey.welcomeTitleBrand))
                .font(tokens.typography.titleHero)
                .foregroundStyle(tokens.colors.actionPrimary)
                .frame(maxWidth: .infinity)

            Spacer()

            Image("brand_logo")
                .resizable()
                .scaledToFit()
                .frame(width: AuthWelcomeLayout.logoSize, height: AuthWelcomeLayout.logoSize)
                .frame(maxWidth: .infinity)

            Spacer()

            reguertaButton(
                localizedKey(AccessL10nKey.welcomeCtaEnter),
                fullWidth: true,
                accessibilityIdentifier: "auth.welcome.enterButton"
            ) {
                rootViewModel.dispatchShell(.continueFromWelcome)
            }
            .frame(maxWidth: AuthWelcomeLayout.maximumActionWidth)
            .frame(maxWidth: .infinity)

            Spacer()

            let registrationPromptLayout = dynamicTypeSize.isAccessibilitySize
                ? AnyLayout(VStackLayout(spacing: tokens.spacing.xs))
                : AnyLayout(HStackLayout(spacing: tokens.spacing.xs))
            registrationPromptLayout {
                Text(localizedKey(AccessL10nKey.welcomeNotRegistered))
                    .font(tokens.typography.titleCard)
                    .foregroundStyle(tokens.colors.textSecondary)
                Button {
                    rootViewModel.dispatchShell(.openRegisterFromWelcome)
                } label: {
                    Text(localizedKey(AccessL10nKey.welcomeLinkRegister))
                        .font(tokens.typography.titleCard)
                        .foregroundStyle(tokens.colors.actionPrimary)
                }
                .buttonStyle(.plain)
                .frame(minHeight: tokens.layout.minimumTouchTarget)
            }
            .frame(maxWidth: .infinity)
            .padding(.bottom, tokens.spacing.sm)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    var loginRoute: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            authHeader(titleKey: AccessL10nKey.loginTitle)
            signInCard
        }
    }

    var registerRoute: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            authHeader(titleKey: AccessL10nKey.registerTitle)
            signUpCard
        }
    }

    var recoverRoute: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            authHeader(titleKey: AccessL10nKey.recoverTitle)
            recoverPasswordCard
        }
    }

    func authHeader(titleKey: String) -> some View {
        ReguertaScreenHeaderView(
            configuration: ReguertaScreenHeaderConfiguration(
                title: .localized(titleKey),
                leadingAction: ReguertaHeaderAction(
                    systemImageName: "chevron.left",
                    accessibilityLabel: .localized(AccessL10nKey.commonBack),
                    accessibilityIdentifier: "auth.header.backButton",
                    action: {
                        rootViewModel.dispatchShell(.back)
                    }
                )
            )
        )
    }
}
