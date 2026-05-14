import SwiftUI

extension AccessRootRoutingView {
    @ViewBuilder
    var currentAuthRoute: some View {
        switch shellState.currentRoute {
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
            Spacer(minLength: tokens.spacing.md)

            Text(localizedKey(AccessL10nKey.welcomeTitlePrefix))
                .font(.custom("CabinSketch-Regular", size: 22.resize, relativeTo: .headline))
                .foregroundStyle(tokens.colors.textPrimary)
                .frame(maxWidth: .infinity)

            Text(localizedKey(AccessL10nKey.welcomeTitleBrand))
                .font(.custom("CabinSketch-Bold", size: 40.resize, relativeTo: .title))
                .foregroundStyle(tokens.colors.actionPrimary)
                .frame(maxWidth: .infinity)

            Spacer().frame(height: 24.resize)

            Image("brand_logo")
                .resizable()
                .scaledToFit()
                .frame(width: 214.resize, height: 214.resize)
                .frame(maxWidth: .infinity)

            Spacer(minLength: 0)

            reguertaButton(
                localizedKey(AccessL10nKey.welcomeCtaEnter),
                fullWidth: true,
                accessibilityIdentifier: "auth.welcome.enterButton"
            ) {
                dispatchShell(.continueFromWelcome)
            }
            .frame(maxWidth: 320.resize)
            .frame(maxWidth: .infinity)

            Spacer(minLength: 0)

            HStack(spacing: tokens.spacing.xs) {
                Text(localizedKey(AccessL10nKey.welcomeNotRegistered))
                    .font(tokens.typography.titleCard)
                    .foregroundStyle(tokens.colors.textSecondary)
                Button {
                    dispatchShell(.openRegisterFromWelcome)
                } label: {
                    Text(localizedKey(AccessL10nKey.welcomeLinkRegister))
                        .font(tokens.typography.titleCard)
                        .foregroundStyle(tokens.colors.actionPrimary)
                }
                .buttonStyle(.plain)
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
            viewModel: ReguertaScreenHeaderViewModel(
                title: .localized(titleKey),
                leadingAction: ReguertaHeaderAction(
                    systemImageName: "chevron.left",
                    accessibilityLabel: .localized(AccessL10nKey.commonBack),
                    accessibilityIdentifier: "auth.header.backButton",
                    action: {
                        dispatchShell(.back)
                    }
                )
            )
        )
    }
}
