import SwiftUI

extension ContentView {
    @ViewBuilder
    var overlayDialogs: some View {
        if showsRecoverSuccessDialog {
            ReguertaDialog(
                type: .info,
                title: "Restablecer contraseña",
                message: "Se ha enviado el correo de restablecimiento de la contraseña con éxito. Revisa tu correo.",
                primaryAction: ReguertaDialogAction(
                    title: "Aceptar",
                    action: handleRecoverSuccessDialogDismiss
                ),
                onDismiss: handleRecoverSuccessDialogDismiss
            )
        }
        if viewModel.showSessionExpiredDialog {
            ReguertaDialog(
                type: .error,
                title: l10n(AccessL10nKey.sessionExpiredTitle),
                message: l10n(AccessL10nKey.sessionExpiredMessage),
                primaryAction: ReguertaDialogAction(
                    title: l10n(AccessL10nKey.sessionExpiredAction),
                    action: handleSessionExpiredDialogAction
                ),
                onDismiss: handleSessionExpiredDialogAction
            )
        }
        if viewModel.showUnauthorizedDialog {
            ReguertaDialog(
                type: .info,
                title: l10n(AccessL10nKey.unauthorizedDialogTitle),
                message: l10n(AccessL10nKey.unauthorizedDialogMessage),
                primaryAction: ReguertaDialogAction(
                    title: l10n(AccessL10nKey.unauthorizedDialogAction),
                    action: handleUnauthorizedDialogSignOut
                ),
                dismissible: false
            )
        }
        if let article = pendingNewsDeletionArticle {
            ReguertaDialog(
                type: .error,
                title: l10n(AccessL10nKey.newsDeleteDialogTitle),
                message: l10n(AccessL10nKey.newsDeleteDialogMessage, article.title),
                primaryAction: ReguertaDialogAction(
                    title: l10n(AccessL10nKey.newsDeleteActionConfirm),
                    action: confirmPendingNewsDeletion
                ),
                secondaryAction: ReguertaDialogAction(
                    title: l10n(AccessL10nKey.newsDeleteActionCancel),
                    action: clearPendingNewsDeletion
                ),
                onDismiss: clearPendingNewsDeletion
            )
        }
    }

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

    @ViewBuilder
    var feedbackMessageRoute: some View {
        if let feedbackKey = viewModel.feedbackMessageKey {
            ReguertaCard {
                VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                    ReguertaInlineFeedback(localizedKey(feedbackKey))
                    ReguertaButton(
                        localizedKey(AccessL10nKey.dismissMessage),
                        variant: .text,
                        fullWidth: false
                    ) {
                        viewModel.clearFeedbackMessage()
                    }
                }
            }
        }
    }

    var splashRoute: some View {
        ZStack {
            VStack {
                Spacer(minLength: 0)
                Image("brand_logo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 100.resize, height: 100.resize)
                    .scaleEffect(splashScale)
                    .rotationEffect(.degrees(splashRotation))
                    .opacity(splashOpacity)
                    .task(id: shellState.currentRoute) {
                        startSplashAnimationIfNeeded()
                    }
                Spacer(minLength: 0)
            }

            startupVersionGateOverlay
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    var startupVersionGateOverlay: some View {
        switch startupGateState {
        case .optionalUpdate(let storeURL):
            startupVersionGateCard(
                titleKey: AccessL10nKey.startupUpdateOptionalTitle,
                messageKey: AccessL10nKey.startupUpdateMessage,
                primaryActionTitleKey: AccessL10nKey.startupUpdateActionUpdate,
                secondaryActionTitleKey: AccessL10nKey.startupUpdateActionLater,
                onPrimaryAction: {
                    openStoreURL(storeURL)
                    startupGateState = .optionalDismissed
                },
                onSecondaryAction: {
                    startupGateState = .optionalDismissed
                }
            )
        case .forcedUpdate(let storeURL):
            startupVersionGateCard(
                titleKey: AccessL10nKey.startupUpdateForcedTitle,
                messageKey: AccessL10nKey.startupUpdateMessage,
                primaryActionTitleKey: AccessL10nKey.startupUpdateActionUpdate,
                secondaryActionTitleKey: nil,
                onPrimaryAction: {
                    openStoreURL(storeURL)
                },
                onSecondaryAction: nil
            )
        case .checking, .ready, .optionalDismissed:
            EmptyView()
        }
    }

    @ViewBuilder
    func startupVersionGateCard(
        titleKey: String,
        messageKey: String,
        primaryActionTitleKey: String,
        secondaryActionTitleKey: String?,
        onPrimaryAction: @escaping () -> Void,
        onSecondaryAction: (() -> Void)?
    ) -> some View {
        ReguertaDialog(
            type: onSecondaryAction == nil ? .error : .info,
            title: l10n(titleKey),
            message: l10n(messageKey),
            primaryAction: ReguertaDialogAction(
                title: l10n(primaryActionTitleKey),
                action: onPrimaryAction
            ),
            secondaryAction: {
                guard let secondaryActionTitleKey, let onSecondaryAction else { return nil }
                return ReguertaDialogAction(
                    title: l10n(secondaryActionTitleKey),
                    action: onSecondaryAction
                )
            }(),
            onDismiss: onSecondaryAction
        )
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
    var signInCard: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            ReguertaInputField(
                localizedKey(AccessL10nKey.emailLabel),
                text: binding(\.emailInput),
                placeholder: localizedKey(AccessL10nKey.inputPlaceholderTapToType),
                errorMessage: viewModel.emailErrorKey.map(localizedKey),
                liveValidationMessage: localizedKey(AccessL10nKey.feedbackEmailInvalid),
                liveValidation: { isValidEmail($0) },
                isEnabled: !viewModel.isAuthenticating,
                showsClearAction: true,
                keyboardType: .emailAddress
            )

            ReguertaInputField(
                localizedKey(AccessL10nKey.passwordLabel),
                text: binding(\.passwordInput),
                placeholder: localizedKey(AccessL10nKey.inputPlaceholderTapToType),
                errorMessage: viewModel.passwordErrorKey.map(localizedKey),
                liveValidationMessage: localizedKey(AccessL10nKey.authErrorWeakPassword),
                liveValidation: { isValidPassword($0) },
                isEnabled: !viewModel.isAuthenticating,
                isSecure: true,
                showsPasswordToggle: true,
                keyboardType: .default
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

            ReguertaButton(
                localizedKey(viewModel.isAuthenticating ? AccessL10nKey.signingIn : AccessL10nKey.signIn),
                isEnabled: viewModel.canSubmitSignIn,
                isLoading: viewModel.isAuthenticating
            ) {
                viewModel.signIn()
            }
        }
    }

    var signUpCard: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            ReguertaInputField(
                localizedKey(AccessL10nKey.emailLabel),
                text: binding(\.registerEmailInput),
                placeholder: localizedKey(AccessL10nKey.inputPlaceholderTapToType),
                errorMessage: viewModel.registerEmailErrorKey.map(localizedKey),
                liveValidationMessage: localizedKey(AccessL10nKey.feedbackEmailInvalid),
                liveValidation: { isValidEmail($0) },
                isEnabled: !viewModel.isRegistering,
                showsClearAction: true,
                keyboardType: .emailAddress
            )

            ReguertaInputField(
                localizedKey(AccessL10nKey.passwordLabel),
                text: binding(\.registerPasswordInput),
                placeholder: localizedKey(AccessL10nKey.inputPlaceholderTapToType),
                errorMessage: viewModel.registerPasswordErrorKey.map(localizedKey),
                liveValidationMessage: localizedKey(AccessL10nKey.authErrorWeakPassword),
                liveValidation: { isValidPassword($0) },
                isEnabled: !viewModel.isRegistering,
                isSecure: true,
                sharedPasswordVisibility: $areRegisterPasswordsVisible,
                showsPasswordToggle: true,
                keyboardType: .default
            )

            ReguertaInputField(
                localizedKey(AccessL10nKey.registerRepeatPasswordLabel),
                text: binding(\.registerRepeatPasswordInput),
                placeholder: localizedKey(AccessL10nKey.inputPlaceholderTapToType),
                errorMessage: viewModel.registerRepeatPasswordErrorKey.map(localizedKey),
                liveValidationMessageProvider: { repeatedPassword in
                    if repeatedPassword.isEmpty {
                        return localizedKey(AccessL10nKey.feedbackPasswordRepeatRequired)
                    }
                    if !isValidPassword(repeatedPassword) {
                        return localizedKey(AccessL10nKey.authErrorWeakPassword)
                    }
                    if repeatedPassword != viewModel.registerPasswordInput {
                        return localizedKey(AccessL10nKey.feedbackPasswordMismatch)
                    }
                    return nil
                },
                isEnabled: !viewModel.isRegistering,
                isSecure: true,
                sharedPasswordVisibility: $areRegisterPasswordsVisible,
                showsPasswordToggle: true,
                keyboardType: .default
            )

            Spacer(minLength: 72.resize)

            ReguertaButton(
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
            ReguertaInputField(
                localizedKey(AccessL10nKey.emailLabel),
                text: binding(\.recoverEmailInput),
                placeholder: localizedKey(AccessL10nKey.inputPlaceholderTapToType),
                errorMessage: viewModel.recoverEmailErrorKey.map(localizedKey),
                liveValidationMessage: localizedKey(AccessL10nKey.feedbackEmailInvalid),
                liveValidation: { isValidEmail($0) },
                isEnabled: !viewModel.isRecoveringPassword,
                showsClearAction: true,
                keyboardType: .emailAddress
            )

            Spacer(minLength: 88.resize)

            ReguertaButton(
                localizedKey(viewModel.isRecoveringPassword ? AccessL10nKey.recoverActionSending : AccessL10nKey.recoverActionSendEmail),
                isEnabled: viewModel.canSubmitPasswordReset,
                isLoading: viewModel.isRecoveringPassword
            ) {
                viewModel.sendPasswordReset()
            }
        }
    }
    func handleSessionExpiredDialogAction() {
        viewModel.dismissSessionExpiredDialog()
        viewModel.resetSignInDraft()
        dispatchShell(.reauthenticate)
    }

    func handleUnauthorizedDialogSignOut() {
        homeDestination = .dashboard
        viewModel.signOut()
        dispatchShell(.signedOut)
    }

    func confirmPendingNewsDeletion() {
        guard let pendingNewsDeletionId else { return }
        viewModel.deleteNews(newsId: pendingNewsDeletionId) {
            self.pendingNewsDeletionId = nil
        }
    }

    func clearPendingNewsDeletion() {
        pendingNewsDeletionId = nil
    }
    func openStoreURL(_ rawURL: String) {
        guard let url = URL(string: rawURL.trimmingCharacters(in: .whitespacesAndNewlines)) else {
            return
        }
        openURL(url)
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

    func handleAuthRouteExit(from previousRoute: AuthShellRoute, to newRoute: AuthShellRoute) {
        guard previousRoute != newRoute else { return }
        if previousRoute == .home || newRoute != .home {
            isHomeDrawerOpen = false
            homeDrawerDragOffset = 0
        }

        switch previousRoute {
        case .login where newRoute != .login:
            viewModel.resetSignInDraft()
            viewModel.clearFeedbackMessage()
        case .register where newRoute != .register:
            viewModel.resetSignUpDraft()
            viewModel.clearFeedbackMessage()
            areRegisterPasswordsVisible = false
        case .recoverPassword where newRoute != .recoverPassword:
            viewModel.resetRecoverDraft()
            viewModel.clearFeedbackMessage()
            showsRecoverSuccessDialog = false
        default:
            break
        }
    }

    func handleRecoverSuccessDialogDismiss() {
        showsRecoverSuccessDialog = false
        viewModel.resetRecoverDraft()
        dispatchShell(.signedOut)
    }

    func isValidEmail(_ value: String) -> Bool {
        value.trimmingCharacters(in: .whitespacesAndNewlines).range(
            of: "^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$",
            options: [.regularExpression, .caseInsensitive]
        ) != nil
    }

    func isValidPassword(_ value: String) -> Bool {
        (6...16).contains(value.count)
    }
}
