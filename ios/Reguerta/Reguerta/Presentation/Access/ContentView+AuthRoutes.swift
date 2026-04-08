import SwiftUI

extension ContentView {
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

            ReguertaButton(
                localizedKey(AccessL10nKey.welcomeCtaEnter),
                fullWidth: true
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
            HStack {
                authBackButton
                Spacer()
            }
            Text(localizedKey(AccessL10nKey.loginTitle))
                .font(tokens.typography.titleHero)
                .foregroundStyle(tokens.colors.actionPrimary)
            signInCard
        }
    }

    var registerRoute: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            HStack {
                authBackButton
                Spacer()
            }
            Text(localizedKey(AccessL10nKey.registerTitle))
                .font(tokens.typography.titleHero)
                .foregroundStyle(tokens.colors.actionPrimary)
            signUpCard
        }
    }

    var recoverRoute: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            HStack {
                authBackButton
                Spacer()
            }
            Text(localizedKey(AccessL10nKey.recoverTitle))
                .font(tokens.typography.titleHero)
                .foregroundStyle(tokens.colors.actionPrimary)
            recoverPasswordCard
        }
    }

    var authBackButton: some View {
        Button {
            dispatchShell(.back)
        } label: {
            Image(systemName: "chevron.left")
                .font(tokens.typography.body)
                .foregroundStyle(tokens.colors.textPrimary)
                .frame(width: 64.resize, height: 36.resize, alignment: .leading)
        }
        .buttonStyle(.plain)
        .contentShape(Rectangle())
    }
}
