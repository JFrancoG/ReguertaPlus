import SwiftUI

struct ContentView: View {
    @Environment(\.openURL) private var openURL
    @Environment(\.reguertaTokens) private var tokens
    @Environment(\.scenePhase) private var scenePhase
    @State private var viewModel = SessionViewModel()
    @State private var shellState = AuthShellState()
    @State private var splashScale: CGFloat = SplashAnimationContract.initialScale
    @State private var splashRotation: Double = SplashAnimationContract.initialRotation
    @State private var splashOpacity: Double = SplashAnimationContract.initialOpacity
    @State private var didStartSplashAnimation = false
    @State private var splashDelayCompleted = false
    @State private var startupGateState: StartupGateUIState = .checking
    @State private var didEvaluateStartupGate = false
    @State private var areRegisterPasswordsVisible = false
    @State private var showsRecoverSuccessDialog = false
    @State private var isHomeDrawerOpen = false
    @State private var homeDrawerDragOffset: CGFloat = 0
    @State private var isAdminToolsExpanded = false
    @State private var homeDestination: HomeDestination = .dashboard
    @State private var pendingNewsDeletionId: String?

    private let startupVersionGateUseCase = ResolveStartupVersionGateUseCase(
        repository: FirestoreStartupVersionPolicyRepository()
    )

    private var shouldSkipSplash: Bool {
        ProcessInfo.processInfo.arguments.contains("-skipSplash")
    }

    private var isHomeRoute: Bool {
        shellState.currentRoute == .home
    }

    private var installedVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.0.0"
    }

    var body: some View {
        NavigationStack {
            Group {
                if isHomeRoute {
                    homeRoute
                } else if shellState.currentRoute == .splash {
                    splashRoute
                } else {
                    GeometryReader { proxy in
                        ScrollView(.vertical, showsIndicators: false) {
                            VStack(alignment: .leading, spacing: tokens.spacing.lg) {
                                currentAuthRoute
                                feedbackMessageRoute
                            }
                            .frame(maxWidth: .infinity, alignment: .topLeading)
                            .frame(minHeight: proxy.size.height, alignment: .top)
                            .padding(.bottom, tokens.spacing.md)
                        }
                        .scrollDismissesKeyboard(.interactively)
                    }
                }
            }
            .padding(tokens.spacing.lg)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background(tokens.colors.surfacePrimary.ignoresSafeArea())
            .overlay {
                DeviceScaleCaptureView()
            }
            .toolbar(.hidden, for: .navigationBar)
        }
        .overlay {
            overlayDialogs
        }
        .task(id: shellState.currentRoute) {
            await handleSplashIfNeeded()
        }
        .task {
            viewModel.refreshSession(trigger: .startup)
            await evaluateStartupGateIfNeeded()
        }
        .onChange(of: viewModel.mode) { _, mode in
            if mode.isAuthenticatedSession, shellState.currentRoute != .splash {
                dispatchShell(.sessionAuthenticated)
            } else if shellState.currentRoute == .home {
                switch mode {
                case .signedOut:
                    dispatchShell(.signedOut)
                case .authorized, .unauthorized:
                    break
                }
            }
        }
        .onChange(of: scenePhase) { _, newPhase in
            switch newPhase {
            case .active:
                viewModel.refreshSession(trigger: .foreground)
            default:
                break
            }
        }
        .onChange(of: startupGateState) { _, _ in
            continueFromSplashIfAllowed()
        }
        .onChange(of: splashDelayCompleted) { _, _ in
            continueFromSplashIfAllowed()
        }
        .onChange(of: shellState.currentRoute) { previousRoute, route in
            if route != .splash {
                resetSplashAnimationState()
            }
            handleAuthRouteExit(from: previousRoute, to: route)
        }
        .onChange(of: viewModel.feedbackMessageKey) { _, feedbackKey in
            guard feedbackKey == AccessL10nKey.authInfoPasswordResetSent else { return }
            viewModel.clearFeedbackMessage()
            showsRecoverSuccessDialog = true
        }
    }

    @ViewBuilder
    private var overlayDialogs: some View {
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
    private var currentAuthRoute: some View {
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
    private var feedbackMessageRoute: some View {
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

    private var splashRoute: some View {
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
    private var startupVersionGateOverlay: some View {
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
    private func startupVersionGateCard(
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

    private var welcomeRoute: some View {
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

    private var loginRoute: some View {
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

    private var registerRoute: some View {
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

    private var recoverRoute: some View {
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

    private var homeRoute: some View {
        GeometryReader { proxy in
            let drawerWidth = min(320.resize, proxy.size.width * 0.78)

            ZStack(alignment: .leading) {
                ScrollView(.vertical, showsIndicators: false) {
                    VStack(alignment: .leading, spacing: tokens.spacing.lg) {
                        homeShellTopBar
                        homeRouteContent

                        if viewModel.feedbackMessageKey != nil {
                            feedbackMessageRoute
                        }
                    }
                    .padding(.vertical, tokens.spacing.lg)
                }
                .scrollDismissesKeyboard(.interactively)
                .disabled(isHomeDrawerOpen)

                if isHomeDrawerOpen {
                    Color.black.opacity(0.18)
                        .ignoresSafeArea()
                        .contentShape(Rectangle())
                        .onTapGesture {
                            closeHomeDrawer()
                        }
                }

                homeDrawerPanel(drawerWidth: drawerWidth)

                if !isHomeDrawerOpen {
                    Color.clear
                        .frame(width: 22.resize)
                        .contentShape(Rectangle())
                        .gesture(
                            DragGesture(minimumDistance: 12)
                                .onChanged { gesture in
                                    homeDrawerDragOffset = max(0, min(drawerWidth, gesture.translation.width))
                                }
                                .onEnded { gesture in
                                    if gesture.translation.width > 48.resize {
                                        openHomeDrawer()
                                    } else {
                                        homeDrawerDragOffset = 0
                                    }
                                }
                        )
                }
            }
        }
    }

    @ViewBuilder
    private var homeRouteContent: some View {
        switch homeDestination {
        case .dashboard:
            dashboardRoute
        case .news:
            newsListRoute
        case .publishNews:
            newsEditorRoute
        default:
            placeholderRoute(
                titleKey: homeDestination.titleKey,
                subtitleKey: homeDestination.subtitleKey
            )
        }
    }

    @ViewBuilder
    private var dashboardRoute: some View {
        weeklyContextCard

        switch viewModel.mode {
        case .signedOut:
            cardContainer {
                Text(localizedKey(AccessL10nKey.signedOutHint))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
            }
        case .unauthorized:
            EmptyView()
        case .authorized(let session):
            authorizedHome(session: session)
        }

        latestNewsCard
    }

    private var homeShellTopBar: some View {
        cardContainer {
            HStack {
                Button {
                    if homeDestination == .dashboard {
                        openHomeDrawer()
                    } else {
                        if homeDestination == .publishNews {
                            viewModel.clearNewsEditor()
                            homeDestination = .news
                        } else {
                            homeDestination = .dashboard
                        }
                    }
                } label: {
                    Image(systemName: homeDestination == .dashboard ? "line.3.horizontal" : "chevron.left")
                        .font(.system(size: 22.resize, weight: .semibold))
                        .foregroundStyle(tokens.colors.textPrimary)
                        .frame(width: 44.resize, height: 44.resize)
                }
                .buttonStyle(.plain)
                .contentShape(Rectangle())

                Spacer()

                Text(localizedKey(homeDestination.titleKey))
                    .font(tokens.typography.titleCard)
                    .foregroundStyle(tokens.colors.textPrimary)

                Spacer()

                Button {
                } label: {
                    Image(systemName: "bell")
                        .font(.system(size: 20.resize, weight: .semibold))
                        .foregroundStyle(tokens.colors.textPrimary)
                        .frame(width: 44.resize, height: 44.resize)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(localizedKey(AccessL10nKey.homeShellNotifications))
            }
        }
    }

    private var signInCard: some View {
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

    private var signUpCard: some View {
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

    private var recoverPasswordCard: some View {
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

    @ViewBuilder
    private func unauthorizedCard(email: String, reason: UnauthorizedReason) -> some View {
        cardContainer {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(localizedKey(AccessL10nKey.unauthorized))
                    .font(tokens.typography.titleCard)
                Text(localizedKey(AccessL10nKey.unauthorizedExplanation))
                    .font(tokens.typography.body)
                Text(l10n(AccessL10nKey.signedInEmail, email))
                Text(localizedKey(AccessL10nKey.restrictedModeInfo))
                Text(localizedKey(AccessL10nKey.unauthorizedContactAdmin))
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
                Text(l10n(AccessL10nKey.reason, localizedUnauthorizedReason(reason)))
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
                ReguertaButton(localizedKey(AccessL10nKey.signOut)) {
                    viewModel.signOut()
                    dispatchShell(.signedOut)
                }
            }
        }
    }

    @ViewBuilder
    private func authorizedHome(session: AuthorizedSession) -> some View {
        operationalModules(
            modulesEnabled: true,
            myOrderFreshnessState: viewModel.myOrderFreshnessState
        )

        if session.member.isAdmin {
            adminToolsCard(session: session)
        }
    }

    private var weeklyContextCard: some View {
        cardContainer {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(localizedKey(AccessL10nKey.homeShellWeeklyTitle))
                    .font(tokens.typography.titleCard)
                weeklyContextRow(
                    titleKey: AccessL10nKey.homeShellWeeklyResponsible,
                    value: localizedKey(AccessL10nKey.homeShellWeeklyPending)
                )
                weeklyContextRow(
                    titleKey: AccessL10nKey.homeShellWeeklySupport,
                    value: localizedKey(AccessL10nKey.homeShellWeeklyPending)
                )
                weeklyContextRow(
                    titleKey: AccessL10nKey.homeShellWeeklyMainProducer,
                    value: localizedKey(AccessL10nKey.homeShellWeeklyPending)
                )
                weeklyContextRow(
                    titleKey: AccessL10nKey.homeShellWeeklyDelivery,
                    value: localizedKey(AccessL10nKey.homeShellWeeklyDeliveryDefault)
                )
            }
        }
    }

    private var latestNewsCard: some View {
        cardContainer {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(localizedKey(AccessL10nKey.homeShellNewsTitle))
                    .font(tokens.typography.titleCard)
                if viewModel.latestNews.isEmpty {
                    Text(localizedKey(AccessL10nKey.newsEmptyState))
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)
                } else {
                    ForEach(viewModel.latestNews) { article in
                        VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                            Text(article.title)
                                .font(tokens.typography.body.weight(.semibold))
                                .foregroundStyle(tokens.colors.textPrimary)
                            Text(article.body)
                                .font(tokens.typography.bodySecondary)
                                .foregroundStyle(tokens.colors.textSecondary)
                                .lineLimit(3)
                        }
                    }
                }
                ReguertaButton(
                    localizedKey(AccessL10nKey.newsViewAll),
                    variant: .text
                ) {
                    homeDestination = .news
                    viewModel.refreshNews()
                }
            }
        }
    }

    @ViewBuilder
    private func operationalModules(
        modulesEnabled: Bool,
        myOrderFreshnessState: MyOrderFreshnessState,
        disabledMessageKey: String? = nil
    ) -> some View {
        cardContainer {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(localizedKey(AccessL10nKey.operationalModulesTitle))
                    .font(tokens.typography.titleCard)
                Button {
                } label: {
                    Text(localizedKey(AccessL10nKey.myOrder))
                }
                .disabled(!modulesEnabled || myOrderFreshnessState != .ready)
                Button {
                } label: {
                    Text(localizedKey(AccessL10nKey.catalog))
                }
                .disabled(!modulesEnabled)
                Button {
                } label: {
                    Text(localizedKey(AccessL10nKey.shifts))
                }
                .disabled(!modulesEnabled)

                if !modulesEnabled, let disabledMessageKey {
                    Text(localizedKey(disabledMessageKey))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.textSecondary)
                }

                switch myOrderFreshnessState {
                case .checking:
                    Text(localizedKey(AccessL10nKey.myOrderFreshnessChecking))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.textSecondary)
                case .timedOut, .unavailable:
                    Text(localizedKey(AccessL10nKey.myOrderFreshnessErrorTitle))
                        .font(tokens.typography.bodySecondary.weight(.semibold))
                    Text(localizedKey(AccessL10nKey.myOrderFreshnessErrorMessage))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.textSecondary)
                    Button {
                        viewModel.refreshMyOrderFreshness()
                    } label: {
                        Text(localizedKey(AccessL10nKey.myOrderFreshnessRetry))
                    }
                case .idle, .ready:
                    EmptyView()
                }
            }
        }
    }

    private func weeklyContextRow(titleKey: String, value: LocalizedStringKey) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(localizedKey(titleKey))
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.textPrimary)
            Spacer(minLength: tokens.spacing.md)
            Text(value)
                .font(tokens.typography.label)
                .foregroundStyle(tokens.colors.textSecondary)
        }
    }

    private func newsRow(_ key: String) -> some View {
        HStack(alignment: .top, spacing: tokens.spacing.sm) {
            Text("•")
                .font(tokens.typography.body)
                .foregroundStyle(tokens.colors.actionPrimary)
            Text(localizedKey(key))
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.textPrimary)
        }
    }

    private var newsListRoute: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            newsListHeaderCard

            if viewModel.isLoadingNews {
                cardContainer {
                    Text(localizedKey(AccessL10nKey.newsLoading))
                        .font(tokens.typography.bodySecondary)
                }
            } else if viewModel.newsFeed.isEmpty {
                cardContainer {
                    Text(localizedKey(AccessL10nKey.newsEmptyState))
                        .font(tokens.typography.bodySecondary)
                }
            } else {
                ForEach(viewModel.newsFeed) { article in
                    newsArticleCard(article)
                }
            }
        }
    }

    private var newsListHeaderCard: some View {
        cardContainer {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(localizedKey(AccessL10nKey.homeShellNewsTitle))
                    .font(tokens.typography.titleCard)
                Text(localizedKey(AccessL10nKey.newsListSubtitle))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
                if currentHomeMember?.isAdmin == true {
                    ReguertaButton(localizedKey(AccessL10nKey.newsCreateAction)) {
                        viewModel.startCreatingNews()
                        homeDestination = .publishNews
                    }
                }
                ReguertaButton(
                    localizedKey(AccessL10nKey.newsRefreshAction),
                    variant: .text
                ) {
                    viewModel.refreshNews()
                }
            }
        }
    }

    private func newsArticleCard(_ article: NewsArticle) -> some View {
        cardContainer {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(article.title)
                    .font(tokens.typography.titleCard)
                Text(l10n(AccessL10nKey.newsMetaFormat, article.publishedBy))
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
                if !article.active {
                    Text(localizedKey(AccessL10nKey.newsInactiveBadge))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.actionPrimary)
                }
                Text(article.body)
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textPrimary)
                if let urlImage = article.urlImage {
                    Text(urlImage)
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.actionPrimary)
                }
                if currentHomeMember?.isAdmin == true {
                    HStack {
                        ReguertaButton(
                            localizedKey(AccessL10nKey.newsEditAction),
                            variant: .text,
                            fullWidth: false
                        ) {
                            viewModel.startEditingNews(newsId: article.id)
                            homeDestination = .publishNews
                        }
                        ReguertaButton(
                            localizedKey(AccessL10nKey.newsDeleteAction),
                            variant: .text,
                            fullWidth: false
                        ) {
                            pendingNewsDeletionId = article.id
                        }
                    }
                }
            }
        }
    }

    private var newsEditorRoute: some View {
        cardContainer {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                Text(
                    localizedKey(
                        viewModel.editingNewsId == nil
                        ? AccessL10nKey.newsEditorTitleCreate
                        : AccessL10nKey.newsEditorTitleEdit
                    )
                )
                .font(tokens.typography.titleCard)

                Text(localizedKey(AccessL10nKey.newsEditorSubtitle))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)

                TextField(
                    "",
                    text: newsTitleBinding,
                    prompt: Text(localizedKey(AccessL10nKey.newsFieldTitle))
                )
                .textFieldStyle(.roundedBorder)

                TextField(
                    "",
                    text: newsUrlImageBinding,
                    prompt: Text(localizedKey(AccessL10nKey.newsFieldURLImage))
                )
                .textFieldStyle(.roundedBorder)

                Text(localizedKey(AccessL10nKey.newsFieldBody))
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
                TextEditor(
                    text: newsBodyBinding
                )
                .frame(minHeight: 180.resize)
                .padding(tokens.spacing.sm)
                .background(tokens.colors.surfaceSecondary)
                .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))

                Toggle(
                    localizedKey(AccessL10nKey.newsFieldActive),
                    isOn: newsActiveBinding
                )

                ReguertaButton(
                    localizedKey(
                        viewModel.isSavingNews
                        ? AccessL10nKey.newsSaveActionSaving
                        : (viewModel.editingNewsId == nil ? AccessL10nKey.newsSaveActionCreate : AccessL10nKey.newsSaveActionUpdate)
                    ),
                    isEnabled: !viewModel.isSavingNews,
                    isLoading: viewModel.isSavingNews
                ) {
                    viewModel.saveNews {
                        homeDestination = .news
                    }
                }

                ReguertaButton(
                    localizedKey(AccessL10nKey.commonBack),
                    variant: .text
                ) {
                    viewModel.clearNewsEditor()
                    homeDestination = .news
                }

                Spacer(minLength: tokens.spacing.sm)
            }
        }
    }

    @ViewBuilder
    private func adminToolsCard(session: AuthorizedSession) -> some View {
        cardContainer {
            DisclosureGroup(isExpanded: $isAdminToolsExpanded) {
                VStack(alignment: .leading, spacing: tokens.spacing.md) {
                    ForEach(session.members) { member in
                        memberRow(member: member)
                    }

                    Divider()

                    Text(localizedKey(AccessL10nKey.adminCreatePreAuthorizedTitle))
                        .font(tokens.typography.titleCard)
                    TextField(localizedKey(AccessL10nKey.displayNameLabel), text: draftBinding(\.displayName))
                        .textFieldStyle(.roundedBorder)
                    TextField(localizedKey(AccessL10nKey.emailLabel), text: draftBinding(\.email))
                        .textInputAutocapitalization(.never)
                        .textFieldStyle(.roundedBorder)

                    Toggle(localizedKey(AccessL10nKey.roleMember), isOn: draftBinding(\.isMember))
                    Toggle(localizedKey(AccessL10nKey.roleProducer), isOn: draftBinding(\.isProducer))
                    Toggle(localizedKey(AccessL10nKey.roleAdmin), isOn: draftBinding(\.isAdmin))
                    Toggle(localizedKey(AccessL10nKey.roleActive), isOn: draftBinding(\.isActive))

                    Button {
                        viewModel.createAuthorizedMember()
                    } label: {
                        Text(localizedKey(AccessL10nKey.createMember))
                    }
                }
                .padding(.top, tokens.spacing.sm)
            } label: {
                VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                    Text(localizedKey(AccessL10nKey.adminManageMembersTitle))
                        .font(tokens.typography.titleCard)
                    Text(localizedKey(AccessL10nKey.adminManageMembersSubtitle))
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)
                }
            }
        }
    }

    @ViewBuilder
    private func memberRow(member: Member) -> some View {
        VStack(alignment: .leading, spacing: tokens.spacing.xs + 2) {
            Text(member.displayName)
                .font(tokens.typography.bodySecondary.weight(.semibold))
            Text(member.normalizedEmail)
                .font(tokens.typography.bodySecondary)
            Text(l10n(AccessL10nKey.roles, member.roles.prettyListLocalized))
                .font(tokens.typography.label)
            Text(l10n(AccessL10nKey.authLinked, l10n(member.authUid == nil ? AccessL10nKey.no : AccessL10nKey.yes)))
                .font(tokens.typography.label)
            Text(
                l10n(
                    AccessL10nKey.status,
                    l10n(member.isActive ? AccessL10nKey.statusActive : AccessL10nKey.statusInactive)
                )
            )
            .font(tokens.typography.label)

            HStack {
                Button {
                    viewModel.toggleAdmin(memberId: member.id)
                } label: {
                    Text(localizedKey(member.isAdmin ? AccessL10nKey.revokeAdmin : AccessL10nKey.grantAdmin))
                }
                Button {
                    viewModel.toggleActive(memberId: member.id)
                } label: {
                    Text(localizedKey(member.isActive ? AccessL10nKey.deactivate : AccessL10nKey.activate))
                }
            }
        }
        .padding(tokens.spacing.sm + 2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(tokens.colors.surfaceSecondary)
        .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))
    }

    private func homeDrawerPanel(drawerWidth: CGFloat) -> some View {
        let drawerOffset = resolvedHomeDrawerOffset(drawerWidth: drawerWidth)

        return HStack(spacing: 0) {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                homeDrawerHeader

                ScrollView(.vertical, showsIndicators: false) {
                    VStack(alignment: .leading, spacing: tokens.spacing.md) {
                        homeDrawerProfile
                        homeDrawerNavigationSections
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                Divider()

                homeDrawerFooter
            }
            .padding(tokens.spacing.lg)
            .frame(width: drawerWidth)
            .frame(maxHeight: .infinity, alignment: .topLeading)
            .background(tokens.colors.surfacePrimary)
            .overlay(alignment: .trailing) {
                Rectangle()
                    .fill(tokens.colors.borderSubtle.opacity(0.4))
                    .frame(width: 1)
            }
            .offset(x: drawerOffset)
            .gesture(
                DragGesture(minimumDistance: 12)
                    .onChanged { gesture in
                        if isHomeDrawerOpen {
                            homeDrawerDragOffset = min(0, gesture.translation.width)
                        }
                    }
                    .onEnded { gesture in
                        guard isHomeDrawerOpen else { return }
                        if gesture.translation.width < -56.resize {
                            closeHomeDrawer()
                        } else {
                            withAnimation(.spring(response: 0.28, dampingFraction: 0.82)) {
                                homeDrawerDragOffset = 0
                            }
                        }
                    }
            )

            Spacer(minLength: 0)
        }
        .ignoresSafeArea()
        .allowsHitTesting(isHomeDrawerOpen)
        .animation(.spring(response: 0.28, dampingFraction: 0.82), value: isHomeDrawerOpen)
        .animation(.interactiveSpring(response: 0.25, dampingFraction: 0.84), value: homeDrawerDragOffset)
    }

    private var homeDrawerHeader: some View {
        HStack {
            Button {
                closeHomeDrawer()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 20.resize, weight: .semibold))
                    .foregroundStyle(tokens.colors.textPrimary)
                    .frame(width: 36.resize, height: 36.resize)
            }
            .buttonStyle(.plain)
            .contentShape(Rectangle())
            Spacer()
        }
    }

    @ViewBuilder
    private var homeDrawerProfile: some View {
        VStack(spacing: tokens.spacing.md) {
            Circle()
                .fill(tokens.colors.actionPrimary.opacity(0.14))
                .frame(width: 76.resize, height: 76.resize)
                .overlay {
                    Image(systemName: "person.fill")
                        .font(.system(size: 30.resize, weight: .semibold))
                        .foregroundStyle(tokens.colors.actionPrimary)
                }

            if let member = currentHomeMember {
                Text(member.displayName)
                    .font(tokens.typography.titleCard)
                    .foregroundStyle(tokens.colors.textPrimary)
                    .multilineTextAlignment(.center)
                Text(member.normalizedEmail)
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.bottom, tokens.spacing.sm)
    }

    @ViewBuilder
    private var homeDrawerNavigationSections: some View {
        drawerSection(titleKey: AccessL10nKey.homeShellSectionCommon)
        homeDrawerItem("house.fill", titleKey: AccessL10nKey.homeTitle, destination: .dashboard)
        homeDrawerItem("cart.fill", titleKey: AccessL10nKey.myOrder, destination: .myOrder)
        homeDrawerItem("doc.text.fill", titleKey: AccessL10nKey.myOrders, destination: .myOrders)
        homeDrawerItem("calendar", titleKey: AccessL10nKey.shifts, destination: .shifts)
        homeDrawerItem("newspaper.fill", titleKey: AccessL10nKey.homeShellNewsTitle, destination: .news)
        homeDrawerItem("bell", titleKey: AccessL10nKey.homeShellNotifications, destination: .notifications)
        homeDrawerItem("person.fill", titleKey: AccessL10nKey.homeShellActionProfile, destination: .profile)
        homeDrawerItem("gearshape.fill", titleKey: AccessL10nKey.homeShellActionSettings, destination: .settings)

        if currentHomeMember?.isProducer == true {
            drawerSection(titleKey: AccessL10nKey.homeShellSectionProducer)
            homeDrawerItem("shippingbox.fill", titleKey: AccessL10nKey.homeShellActionProducts, destination: .products)
            homeDrawerItem("tray.full.fill", titleKey: AccessL10nKey.homeShellActionReceivedOrders, destination: .receivedOrders)
        }

        if currentHomeMember?.isAdmin == true {
            drawerSection(titleKey: AccessL10nKey.homeShellSectionAdmin)
            homeDrawerItem("person.3.fill", titleKey: AccessL10nKey.homeShellActionUsers, destination: .users)
            homeDrawerItem("plus.square.fill", titleKey: AccessL10nKey.homeShellActionPublishNews, destination: .publishNews)
            homeDrawerItem("megaphone.fill", titleKey: AccessL10nKey.homeShellActionAdminBroadcast, destination: .adminBroadcast)
        }
    }

    private var homeDrawerFooter: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            ReguertaButton(localizedKey(AccessL10nKey.signOut)) {
                closeHomeDrawer()
                homeDestination = .dashboard
                viewModel.signOut()
                dispatchShell(.signedOut)
            }
            .padding(.top, tokens.spacing.xs)

            Text(l10n(AccessL10nKey.homeShellVersion, installedVersion))
                .font(tokens.typography.label)
                .foregroundStyle(tokens.colors.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func drawerSection(titleKey: String) -> some View {
        Text(localizedKey(titleKey))
            .font(tokens.typography.label)
            .foregroundStyle(tokens.colors.actionPrimary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, tokens.spacing.xs)
    }

    private func homeDrawerItem(
        _ systemImage: String,
        titleKey: String,
        destination: HomeDestination
    ) -> some View {
        HStack(spacing: tokens.spacing.md) {
            Image(systemName: systemImage)
                .font(.system(size: 18.resize, weight: .semibold))
                .foregroundStyle(tokens.colors.actionPrimary)
                .frame(width: 24.resize)
            Text(localizedKey(titleKey))
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.textPrimary)
            Spacer(minLength: tokens.spacing.sm)
        }
        .padding(.vertical, tokens.spacing.xs + 2)
        .padding(.horizontal, tokens.spacing.sm)
        .background(
            homeDestination == destination
            ? tokens.colors.actionPrimary.opacity(0.10)
            : Color.clear
        )
        .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))
        .contentShape(Rectangle())
        .onTapGesture {
            if destination == .publishNews {
                viewModel.startCreatingNews()
            }
            if destination == .news {
                viewModel.refreshNews()
            }
            homeDestination = destination
            closeHomeDrawer()
        }
    }

    @ViewBuilder
    private func placeholderRoute(titleKey: String, subtitleKey: String) -> some View {
        ReguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                Text(localizedKey(titleKey))
                    .font(tokens.typography.titleSection)
                Text(localizedKey(subtitleKey))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
                ReguertaButton(localizedKey(AccessL10nKey.commonBack)) {
                    homeDestination = .dashboard
                }
            }
        }
    }

    @ViewBuilder
    private func cardContainer<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        content()
            .padding(tokens.spacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(tokens.colors.surfacePrimary)
            .overlay(
                RoundedRectangle(cornerRadius: tokens.radius.md)
                    .stroke(tokens.colors.borderSubtle, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: tokens.radius.md))
    }

    private func binding(_ keyPath: ReferenceWritableKeyPath<SessionViewModel, String>) -> Binding<String> {
        Binding(
            get: { viewModel[keyPath: keyPath] },
            set: { viewModel[keyPath: keyPath] = $0 }
        )
    }

    private func draftBinding(_ keyPath: WritableKeyPath<MemberDraft, String>) -> Binding<String> {
        Binding(
            get: { viewModel.memberDraft[keyPath: keyPath] },
            set: {
                var updated = viewModel.memberDraft
                updated[keyPath: keyPath] = $0
                viewModel.memberDraft = updated
            }
        )
    }

    private var newsTitleBinding: Binding<String> {
        Binding(
            get: { viewModel.newsDraft.title },
            set: { value in
                viewModel.updateNewsDraft { $0.title = value }
            }
        )
    }

    private var newsBodyBinding: Binding<String> {
        Binding(
            get: { viewModel.newsDraft.body },
            set: { value in
                viewModel.updateNewsDraft { $0.body = value }
            }
        )
    }

    private var newsUrlImageBinding: Binding<String> {
        Binding(
            get: { viewModel.newsDraft.urlImage },
            set: { value in
                viewModel.updateNewsDraft { $0.urlImage = value }
            }
        )
    }

    private var newsActiveBinding: Binding<Bool> {
        Binding(
            get: { viewModel.newsDraft.active },
            set: { value in
                viewModel.updateNewsDraft { $0.active = value }
            }
        )
    }

    private func draftBinding(_ keyPath: WritableKeyPath<MemberDraft, Bool>) -> Binding<Bool> {
        Binding(
            get: { viewModel.memberDraft[keyPath: keyPath] },
            set: {
                var updated = viewModel.memberDraft
                updated[keyPath: keyPath] = $0
                viewModel.memberDraft = updated
            }
        )
    }

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }

    private var currentHomeMember: Member? {
        switch viewModel.mode {
        case .authorized(let session):
            return session.member
        case .signedOut, .unauthorized:
            return nil
        }
    }

    private var pendingNewsDeletionArticle: NewsArticle? {
        guard let pendingNewsDeletionId else { return nil }
        return viewModel.newsFeed.first(where: { $0.id == pendingNewsDeletionId })
    }

    private func dispatchShell(_ action: AuthShellAction) {
        shellState = reduceAuthShell(state: shellState, action: action)
    }

    private func resolvedHomeDrawerOffset(drawerWidth: CGFloat) -> CGFloat {
        if isHomeDrawerOpen {
            return min(0, homeDrawerDragOffset)
        }
        return -drawerWidth + max(0, homeDrawerDragOffset)
    }

    private func openHomeDrawer() {
        withAnimation(.spring(response: 0.28, dampingFraction: 0.82)) {
            isHomeDrawerOpen = true
            homeDrawerDragOffset = 0
        }
    }

    private func closeHomeDrawer() {
        withAnimation(.spring(response: 0.28, dampingFraction: 0.82)) {
            isHomeDrawerOpen = false
            homeDrawerDragOffset = 0
        }
    }

    private func handleSessionExpiredDialogAction() {
        viewModel.dismissSessionExpiredDialog()
        viewModel.resetSignInDraft()
        dispatchShell(.reauthenticate)
    }

    private func handleUnauthorizedDialogSignOut() {
        homeDestination = .dashboard
        viewModel.signOut()
        dispatchShell(.signedOut)
    }

    private func confirmPendingNewsDeletion() {
        guard let pendingNewsDeletionId else { return }
        viewModel.deleteNews(newsId: pendingNewsDeletionId) {
            self.pendingNewsDeletionId = nil
        }
    }

    private func clearPendingNewsDeletion() {
        pendingNewsDeletionId = nil
    }

    private func handleSplashIfNeeded() async {
        guard shellState.currentRoute == .splash else { return }

        if shouldSkipSplash {
            splashDelayCompleted = true
            startupGateState = .optionalDismissed
            continueFromSplashIfAllowed()
            return
        }

        try? await Task.sleep(nanoseconds: SplashAnimationContract.durationNanoseconds)
        guard shellState.currentRoute == .splash else { return }
        splashDelayCompleted = true
        continueFromSplashIfAllowed()
    }

    private func evaluateStartupGateIfNeeded() async {
        guard !didEvaluateStartupGate else { return }
        didEvaluateStartupGate = true

        if shouldSkipSplash {
            startupGateState = .optionalDismissed
            return
        }

        let installedVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""
        let decision = await resolveStartupGateDecision(installedVersion: installedVersion)

        switch decision {
        case .allow:
            startupGateState = .ready
        case .optionalUpdate(let storeURL):
            startupGateState = .optionalUpdate(storeURL: storeURL)
        case .forcedUpdate(let storeURL):
            startupGateState = .forcedUpdate(storeURL: storeURL)
        }

        continueFromSplashIfAllowed()
    }

    private func resolveStartupGateDecision(installedVersion: String) async -> StartupVersionGateDecision {
        await withTaskGroup(of: StartupVersionGateDecision.self) { group in
            group.addTask {
                await startupVersionGateUseCase.execute(
                    platform: .ios,
                    installedVersion: installedVersion
                )
            }
            group.addTask {
                try? await Task.sleep(nanoseconds: StartupGateContract.fetchTimeoutNanoseconds)
                return .allow
            }

            let firstResult = await group.next() ?? .allow
            group.cancelAll()
            return firstResult
        }
    }

    private func continueFromSplashIfAllowed() {
        guard shellState.currentRoute == .splash else { return }
        guard splashDelayCompleted else { return }
        guard startupGateState.allowsContinuation else { return }
        dispatchShell(.splashCompleted(isAuthenticated: viewModel.mode.isAuthenticatedSession))
    }

    private func openStoreURL(_ rawURL: String) {
        guard let url = URL(string: rawURL.trimmingCharacters(in: .whitespacesAndNewlines)) else {
            return
        }
        openURL(url)
    }

    @MainActor
    private func startSplashAnimationIfNeeded() {
        guard shellState.currentRoute == .splash else { return }
        guard !shouldSkipSplash else { return }
        guard !didStartSplashAnimation else { return }
        didStartSplashAnimation = true

        withAnimation(.easeInOut(duration: SplashAnimationContract.durationSeconds)) {
            splashScale = SplashAnimationContract.finalScale
            splashRotation = SplashAnimationContract.finalRotation
            splashOpacity = SplashAnimationContract.finalOpacity
        }
    }

    @MainActor
    private func resetSplashAnimationState() {
        didStartSplashAnimation = false
        splashDelayCompleted = false
        splashScale = SplashAnimationContract.initialScale
        splashRotation = SplashAnimationContract.initialRotation
        splashOpacity = SplashAnimationContract.initialOpacity
    }

    private func routeTitle(for route: AuthShellRoute) -> LocalizedStringKey {
        switch route {
        case .splash, .welcome:
            return localizedKey(AccessL10nKey.brandReguerta)
        case .login:
            return localizedKey(AccessL10nKey.loginTitle)
        case .register:
            return localizedKey(AccessL10nKey.registerTitle)
        case .recoverPassword:
            return localizedKey(AccessL10nKey.recoverTitle)
        case .home:
            return localizedKey(AccessL10nKey.homeTitle)
        }
    }

    private var authBackButton: some View {
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

    private func handleAuthRouteExit(from previousRoute: AuthShellRoute, to newRoute: AuthShellRoute) {
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

    private func handleRecoverSuccessDialogDismiss() {
        showsRecoverSuccessDialog = false
        viewModel.resetRecoverDraft()
        dispatchShell(.signedOut)
    }

    private func isValidEmail(_ value: String) -> Bool {
        value.trimmingCharacters(in: .whitespacesAndNewlines).range(
            of: "^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$",
            options: [.regularExpression, .caseInsensitive]
        ) != nil
    }

    private func isValidPassword(_ value: String) -> Bool {
        (6...16).contains(value.count)
    }
}

private enum HomeDestination: String, Sendable {
    case dashboard
    case myOrder
    case myOrders
    case shifts
    case news
    case notifications
    case profile
    case settings
    case products
    case receivedOrders
    case users
    case publishNews
    case adminBroadcast
}

private extension HomeDestination {
    var titleKey: String {
        switch self {
        case .dashboard: AccessL10nKey.homeTitle
        case .myOrder: AccessL10nKey.myOrder
        case .myOrders: AccessL10nKey.myOrders
        case .shifts: AccessL10nKey.shifts
        case .news: AccessL10nKey.homeShellNewsTitle
        case .notifications: AccessL10nKey.homeShellNotifications
        case .profile: AccessL10nKey.homeShellActionProfile
        case .settings: AccessL10nKey.homeShellActionSettings
        case .products: AccessL10nKey.homeShellActionProducts
        case .receivedOrders: AccessL10nKey.homeShellActionReceivedOrders
        case .users: AccessL10nKey.homeShellActionUsers
        case .publishNews: AccessL10nKey.homeShellActionPublishNews
        case .adminBroadcast: AccessL10nKey.homeShellActionAdminBroadcast
        }
    }

    var subtitleKey: String {
        switch self {
        case .dashboard: AccessL10nKey.homePlaceholderSubtitle
        case .myOrder: AccessL10nKey.homePlaceholderMyOrder
        case .myOrders: AccessL10nKey.homePlaceholderMyOrders
        case .shifts: AccessL10nKey.homePlaceholderShifts
        case .news: AccessL10nKey.newsListSubtitle
        case .notifications: AccessL10nKey.homePlaceholderNotifications
        case .profile: AccessL10nKey.homePlaceholderProfile
        case .settings: AccessL10nKey.homePlaceholderSettings
        case .products: AccessL10nKey.homePlaceholderProducts
        case .receivedOrders: AccessL10nKey.homePlaceholderReceivedOrders
        case .users: AccessL10nKey.homePlaceholderUsers
        case .publishNews: AccessL10nKey.newsEditorSubtitle
        case .adminBroadcast: AccessL10nKey.homePlaceholderAdminBroadcast
        }
    }
}

private enum StartupGateUIState: Equatable {
    case checking
    case ready
    case optionalUpdate(storeURL: String)
    case forcedUpdate(storeURL: String)
    case optionalDismissed

    var allowsContinuation: Bool {
        self == .ready || self == .optionalDismissed
    }
}

private extension Set<MemberRole> {
    var prettyListLocalized: String {
        sorted { lhs, rhs in lhs.rawValue < rhs.rawValue }
            .map(localizedRoleValue(_:))
            .joined(separator: ", ")
    }
}

private extension Member {
    var isProducer: Bool {
        roles.contains(.producer)
    }
}

#Preview {
    ContentView()
}

private enum SplashAnimationContract {
    static let durationSeconds: Double = 1.5
    static let durationNanoseconds: UInt64 = 1_500_000_000
    static let initialScale: CGFloat = 0.2
    static let finalScale: CGFloat = 18.0
    static let initialRotation: Double = 0
    static let finalRotation: Double = 720.0
    static let initialOpacity: Double = 1.0
    static let finalOpacity: Double = 0.0
}

private enum StartupGateContract {
    static let fetchTimeoutNanoseconds: UInt64 = 2_500_000_000
}
