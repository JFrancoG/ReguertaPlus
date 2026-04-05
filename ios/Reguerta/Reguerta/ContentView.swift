import SwiftUI

struct ContentView: View {
    @Environment(\.openURL) private var openURL
    @Environment(\.reguertaTokens) private var tokens
    @Environment(\.scenePhase) private var scenePhase
    @State private var viewModel: SessionViewModel
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
    @State private var selectedShiftSegment: ShiftBoardSegment = .delivery

    private let startupVersionGateUseCase = ResolveStartupVersionGateUseCase(
        repository: FirestoreStartupVersionPolicyRepository()
    )

    init() {
        let deviceRepository = FirestoreDeviceRegistrationRepository()
        #if DEBUG
        let developImpersonationEnabled = true
        #else
        let developImpersonationEnabled = false
        #endif
        _viewModel = State(
            initialValue: SessionViewModel(
                authorizedDeviceRegistrar: FirebaseAuthorizedDeviceRegistrar(repository: deviceRepository),
                developImpersonationEnabled: developImpersonationEnabled
            )
        )
    }

    private var shouldSkipSplash: Bool {
        ProcessInfo.processInfo.arguments.contains("-skipSplash")
    }

    private var isHomeRoute: Bool {
        shellState.currentRoute == .home
    }

    private var installedVersion: String {
        resolveInstalledAppVersion()
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
        case .shifts:
            shiftsRoute
        case .shiftSwapRequest:
            shiftSwapRequestRoute
        case .news:
            newsListRoute
        case .notifications:
            notificationsListRoute
        case .profile:
            sharedProfileRoute
        case .settings:
            settingsRoute
        case .publishNews:
            newsEditorRoute
        case .adminBroadcast:
            notificationEditorRoute
        default:
            placeholderRoute(
                titleKey: homeDestination.titleKey,
                subtitleKey: homeDestination.subtitleKey
            )
        }
    }

    @ViewBuilder
    private var dashboardRoute: some View {
        nextShiftsCard

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
                        } else if homeDestination == .adminBroadcast {
                            viewModel.clearNotificationEditor()
                            homeDestination = .notifications
                        } else if homeDestination == .shiftSwapRequest {
                            viewModel.clearShiftSwapDraft()
                            homeDestination = .shifts
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
                    homeDestination = .notifications
                    viewModel.refreshNotifications()
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

    private var nextShiftsCard: some View {
        cardContainer {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(localizedKey(AccessL10nKey.shiftsNextTitle))
                    .font(tokens.typography.titleCard)
                Text(localizedKey(AccessL10nKey.shiftsNextSubtitle))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
                if viewModel.isLoadingShifts {
                    Text(localizedKey(AccessL10nKey.shiftsLoading))
                        .font(tokens.typography.bodySecondary)
                } else {
                    shiftSummaryRow(
                        titleKey: AccessL10nKey.shiftsNextDelivery,
                        shift: viewModel.nextDeliveryShift
                    )
                    shiftSummaryRow(
                        titleKey: AccessL10nKey.shiftsNextMarket,
                        shift: viewModel.nextMarketShift
                    )
                }
                ReguertaButton(localizedKey(AccessL10nKey.shiftsViewAll), variant: .text) {
                    homeDestination = .shifts
                    viewModel.refreshShifts()
                }
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
                    homeDestination = .shifts
                    viewModel.refreshShifts()
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

    private func shiftSummaryRow(titleKey: String, shift: ShiftAssignment?) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(localizedKey(titleKey))
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.textPrimary)
            Spacer(minLength: tokens.spacing.md)
            Text(shift.map { shiftSummary($0) } ?? l10n(AccessL10nKey.shiftsNextPending))
                .font(tokens.typography.label)
                .foregroundStyle(tokens.colors.textSecondary)
        }
    }

    @ViewBuilder
    private var shiftsRoute: some View {
        let currentMemberId = currentHomeMember?.id
        let deliveryShifts = viewModel.shiftsFeed
            .filter { $0.type == .delivery }
            .sorted { $0.dateMillis < $1.dateMillis }
        let marketShifts = viewModel.shiftsFeed
            .filter { $0.type == .market }
            .sorted { $0.dateMillis < $1.dateMillis }
        let visibleShifts = selectedShiftSegment == .delivery ? deliveryShifts : marketShifts

        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            cardContainer {
                VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                    Text(localizedKey(AccessL10nKey.shifts))
                        .font(tokens.typography.titleCard)
                    Text(localizedKey(AccessL10nKey.shiftsListSubtitle))
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)
                    ReguertaButton(localizedKey(AccessL10nKey.shiftsRefreshAction), variant: .text) {
                        viewModel.refreshShifts()
                    }
                }
            }

            nextShiftsCard

            shiftSwapRequestsCard

            if viewModel.isLoadingShifts {
                cardContainer {
                    Text(localizedKey(AccessL10nKey.shiftsLoading))
                        .font(tokens.typography.bodySecondary)
                }
            } else if viewModel.shiftsFeed.isEmpty {
                cardContainer {
                    Text(localizedKey(AccessL10nKey.shiftsEmptyState))
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)
                }
            } else {
                Picker("", selection: $selectedShiftSegment) {
                    ForEach(ShiftBoardSegment.allCases, id: \.self) { segment in
                        Text(localizedKey(segment.titleKey)).tag(segment)
                    }
                }
                .pickerStyle(.segmented)

                if visibleShifts.isEmpty {
                    cardContainer {
                        Text(localizedKey(AccessL10nKey.shiftsEmptyState))
                            .font(tokens.typography.bodySecondary)
                            .foregroundStyle(tokens.colors.textSecondary)
                    }
                } else {
                    ForEach(visibleShifts) { shift in
                        shiftBoardCard(shift, currentMemberId: currentMemberId)
                    }
                }
            }
        }
    }

    private var shiftSwapRequestRoute: some View {
        let shift = viewModel.shiftsFeed.first(where: { $0.id == viewModel.shiftSwapDraft.shiftId })
        return cardContainer {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                Text(shiftSwapCopy.title)
                    .font(tokens.typography.titleCard)
                Text(shiftSwapCopy.subtitle)
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
                Text(
                    shiftSwapCopy.shift(
                        shift.map { shiftSwapDisplayLabel($0, memberId: $0.assignedUserIds.first ?? $0.helperUserId) } ?? viewModel.shiftSwapDraft.shiftId
                    )
                )
                    .font(tokens.typography.bodySecondary)
                Text(shiftSwapCopy.broadcastScope(shift?.type == .market ? shiftSwapCopy.marketLabel : shiftSwapCopy.deliveryLabel))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
                Text(shiftSwapCopy.reasonLabel)
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
                TextEditor(
                    text: Binding(
                        get: { viewModel.shiftSwapDraft.reason },
                        set: { newValue in
                            viewModel.updateShiftSwapDraft { $0.reason = newValue }
                        }
                    )
                )
                .frame(minHeight: 160.resize)
                .padding(tokens.spacing.sm)
                .background(tokens.colors.surfaceSecondary)
                .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))

                ReguertaButton(
                    LocalizedStringKey(viewModel.isSavingShiftSwapRequest ? shiftSwapCopy.sending : shiftSwapCopy.send),
                    isEnabled: !viewModel.isSavingShiftSwapRequest &&
                        !viewModel.shiftSwapDraft.shiftId.isEmpty,
                    isLoading: viewModel.isSavingShiftSwapRequest
                ) {
                    viewModel.saveShiftSwapRequest {
                        homeDestination = .shifts
                    }
                }
                ReguertaButton(LocalizedStringKey(shiftSwapCopy.back), variant: .text) {
                    viewModel.clearShiftSwapDraft()
                    homeDestination = .shifts
                }
            }
        }
    }

    private var shiftSwapRequestsCard: some View {
        let currentMemberId = currentHomeMember?.id
        let relevantRequests = viewModel.shiftSwapRequests.filter { request in
            guard let shift = viewModel.shiftsFeed.first(where: { $0.id == request.requestedShiftId }) else { return false }
            return shift.type == (selectedShiftSegment == .delivery ? .delivery : .market)
        }
        let incoming = relevantRequests.flatMap { request in
            request.candidates
                .filter { $0.userId == currentMemberId }
                .filter { candidate in
                    request.status == .open &&
                        !request.responses.contains(where: { $0.userId == candidate.userId && $0.shiftId == candidate.shiftId })
                }
                .map { (request, $0) }
        }
        let requesterOpen = relevantRequests.filter { $0.requesterUserId == currentMemberId && $0.status == .open }
        let availableResponses = requesterOpen.flatMap { request in
            request.availableResponses.compactMap { response in
                request.candidates.first(where: { $0.userId == response.userId && $0.shiftId == response.shiftId }).map {
                    (request, $0, response)
                }
            }
        }
        let outgoing = requesterOpen.filter { $0.availableResponses.isEmpty }
        let history = relevantRequests.filter {
            $0.status != .open && !viewModel.dismissedShiftSwapRequestIds.contains($0.id)
        }

        return cardContainer {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                Text(shiftSwapCopy.requestsTitle)
                    .font(tokens.typography.titleCard)
                Text(shiftSwapCopy.requestsSubtitle)
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)

                if relevantRequests.isEmpty {
                    Text(shiftSwapCopy.empty)
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)
                } else {
                    if !incoming.isEmpty {
                        incomingShiftSwapSection(title: shiftSwapCopy.incoming, pendingCandidates: incoming)
                    }
                    if !availableResponses.isEmpty {
                        requesterResponsesSection(title: shiftSwapCopy.responses, responseOptions: availableResponses)
                    }
                    if !outgoing.isEmpty {
                        waitingShiftSwapSection(title: shiftSwapCopy.outgoing, requests: outgoing)
                    }
                    if !history.isEmpty {
                        historyShiftSwapSection(title: shiftSwapCopy.history, requests: history)
                    }
                }
            }
        }
    }

    private func incomingShiftSwapSection(title: String, pendingCandidates: [(ShiftSwapRequest, ShiftSwapCandidate)]) -> some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            Text(title)
                .font(tokens.typography.label.weight(.semibold))
                .foregroundStyle(tokens.colors.actionPrimary)
            ForEach(Array(pendingCandidates.enumerated()), id: \.offset) { _, item in
                incomingShiftSwapRow(item.0, candidate: item.1)
            }
        }
    }

    private func incomingShiftSwapRow(_ request: ShiftSwapRequest, candidate: ShiftSwapCandidate) -> some View {
        let requestedShift = viewModel.shiftsFeed.first(where: { $0.id == request.requestedShiftId })
        let candidateShift = viewModel.shiftsFeed.first(where: { $0.id == candidate.shiftId })
        return VStack(alignment: .leading, spacing: tokens.spacing.xs) {
            Text(shiftSwapCopy.requestedBy(displayNameForSwap(request.requesterUserId)))
                .font(tokens.typography.body.weight(.semibold))
            Text(shiftSwapCopy.shift(requestedShift.map { shiftSwapDisplayLabel($0, memberId: request.requesterUserId) } ?? request.requestedShiftId))
                .font(tokens.typography.label)
            Text(shiftSwapCopy.offerShift(candidateShift.map { shiftSwapDisplayLabel($0, memberId: candidate.userId) } ?? candidate.shiftId))
                .font(tokens.typography.label)
            Text(shiftSwapCopy.reason(request.reason.isEmpty ? shiftSwapCopy.noReason : request.reason))
                .font(tokens.typography.label)
                .foregroundStyle(tokens.colors.textSecondary)
            HStack(spacing: tokens.spacing.sm) {
                ReguertaButton(LocalizedStringKey(shiftSwapCopy.acceptShort), fullWidth: false) {
                    viewModel.acceptShiftSwapRequest(requestId: request.id, candidateShiftId: candidate.shiftId)
                }
                ReguertaButton(LocalizedStringKey(shiftSwapCopy.rejectShort), variant: .text, fullWidth: false) {
                    viewModel.rejectShiftSwapRequest(requestId: request.id, candidateShiftId: candidate.shiftId)
                }
            }
        }
        .padding(tokens.spacing.sm)
        .background(tokens.colors.surfaceSecondary)
        .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))
    }

    private func requesterResponsesSection(title: String, responseOptions: [(ShiftSwapRequest, ShiftSwapCandidate, ShiftSwapResponse)]) -> some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            Text(title)
                .font(tokens.typography.label.weight(.semibold))
                .foregroundStyle(tokens.colors.actionPrimary)
            ForEach(Array(responseOptions.enumerated()), id: \.offset) { _, item in
                let request = item.0
                let candidate = item.1
                let requestedShift = viewModel.shiftsFeed.first(where: { $0.id == request.requestedShiftId })
                let candidateShift = viewModel.shiftsFeed.first(where: { $0.id == candidate.shiftId })
                VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                    Text(displayNameForSwap(candidate.userId))
                        .font(tokens.typography.body.weight(.semibold))
                    Text(shiftSwapCopy.confirmBeforeAfter(
                        requestedShift.map { shiftSwapDisplayLabel($0, memberId: request.requesterUserId) } ?? request.requestedShiftId,
                        candidateShift.map { shiftSwapDisplayLabel($0, memberId: candidate.userId) } ?? candidate.shiftId
                    ))
                    .font(tokens.typography.label)
                    ReguertaButton(LocalizedStringKey(shiftSwapCopy.confirm), fullWidth: false) {
                        viewModel.confirmShiftSwapRequest(requestId: request.id, candidateShiftId: candidate.shiftId)
                    }
                }
                .padding(tokens.spacing.sm)
                .background(tokens.colors.surfaceSecondary)
                .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))
            }
        }
    }

    private func waitingShiftSwapSection(title: String, requests: [ShiftSwapRequest]) -> some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            Text(title)
                .font(tokens.typography.label.weight(.semibold))
                .foregroundStyle(tokens.colors.actionPrimary)
            ForEach(requests) { request in
                let shift = viewModel.shiftsFeed.first(where: { $0.id == request.requestedShiftId })
                VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                    Text(shift.map { shiftSwapDisplayLabel($0, memberId: request.requesterUserId) } ?? request.requestedShiftId)
                        .font(tokens.typography.body.weight(.semibold))
                    Text(shiftSwapCopy.waitingMany(Set(request.candidates.map(\.userId)).count))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.textSecondary)
                    ReguertaButton(LocalizedStringKey(shiftSwapCopy.cancel), variant: .text, fullWidth: false) {
                        viewModel.cancelShiftSwapRequest(requestId: request.id)
                    }
                }
                .padding(tokens.spacing.sm)
                .background(tokens.colors.surfaceSecondary)
                .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))
            }
        }
    }

    private func historyShiftSwapSection(title: String, requests: [ShiftSwapRequest]) -> some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            Text(title)
                .font(tokens.typography.label.weight(.semibold))
                .foregroundStyle(tokens.colors.actionPrimary)
            ForEach(requests) { request in
                let shift = viewModel.shiftsFeed.first(where: { $0.id == request.requestedShiftId })
                VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                    Text(shift.map { shiftSwapDisplayLabel($0, memberId: request.requesterUserId) } ?? request.requestedShiftId)
                        .font(tokens.typography.body.weight(.semibold))
                    Text(shiftSwapCopy.requestedBy(displayNameForSwap(request.requesterUserId)))
                        .font(tokens.typography.label)
                    Text(shiftSwapCopy.reason(request.reason.isEmpty ? shiftSwapCopy.noReason : request.reason))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.textSecondary)
                    Text(shiftSwapStatusLabel(request.status))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.actionPrimary)
                    if let selectedUserId = request.selectedCandidateUserId {
                        Text(shiftSwapCopy.selected(displayNameForSwap(selectedUserId)))
                            .font(tokens.typography.label)
                            .foregroundStyle(tokens.colors.textSecondary)
                    }
                    if request.status == .applied {
                        ReguertaButton(LocalizedStringKey(shiftSwapCopy.acknowledge), variant: .text, fullWidth: false) {
                            viewModel.dismissShiftSwapActivity(requestId: request.id)
                        }
                    }
                }
                .padding(tokens.spacing.sm)
                .background(tokens.colors.surfaceSecondary)
                .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))
            }
        }
    }

    private func shiftBoardCard(_ shift: ShiftAssignment, currentMemberId: String?) -> some View {
        let leftColumnWidth = shift.type == .market ? 88.resize : 104.resize
        let leftAlignment: HorizontalAlignment = shift.type == .market ? .center : .leading
        let canRequestSwap = currentMemberId.map { shift.canBeRequested(by: $0) } ?? false
        let highlightedIndex = currentMemberId.flatMap { shift.highlightedBoardNameIndex(for: $0) }
        return cardContainer {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                HStack(alignment: .top, spacing: tokens.spacing.md) {
                    VStack(alignment: leftAlignment, spacing: tokens.spacing.xs) {
                        ForEach(Array(shift.leftBoardLines(tokens: tokens).enumerated()), id: \.offset) { _, line in
                            Text(line.text)
                                .font(line.font)
                                .fontWeight(line.weight)
                                .foregroundStyle(line.color)
                                .multilineTextAlignment(shift.type == .market ? .center : .leading)
                        }
                    }
                    .frame(width: leftColumnWidth, alignment: shift.type == .market ? .center : .leading)

                    VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                        ForEach(Array(shift.boardNames(session: currentHomeSession).enumerated()), id: \.offset) { index, name in
                            Text(name)
                                .font(shift.type == .market ? tokens.typography.bodySecondary : (index == 0 ? tokens.typography.body : tokens.typography.bodySecondary))
                                .fontWeight(shift.type == .market ? .regular : (index == 0 ? .semibold : .regular))
                                .foregroundStyle(
                                    highlightedIndex == index ?
                                        tokens.colors.actionPrimary :
                                        tokens.colors.textPrimary
                                )
                        }
                        if shift.status != .planned {
                            Text(localizedKey(shift.status.titleKey))
                                .font(tokens.typography.label)
                                .foregroundStyle(tokens.colors.textSecondary)
                        }
                    }
                }
                if highlightedIndex != nil && canRequestSwap {
                    ReguertaButton(LocalizedStringKey(shiftSwapCopy.ask), variant: .text, fullWidth: false) {
                        viewModel.startCreatingShiftSwap(shiftId: shift.id)
                        homeDestination = .shiftSwapRequest
                    }
                }
            }
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

    private var notificationsListRoute: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            notificationsListHeaderCard

            if viewModel.isLoadingNotifications {
                cardContainer {
                    Text(localizedKey(AccessL10nKey.notificationsLoading))
                        .font(tokens.typography.bodySecondary)
                }
            } else if viewModel.notificationsFeed.isEmpty {
                cardContainer {
                    Text(localizedKey(AccessL10nKey.notificationsEmptyState))
                        .font(tokens.typography.bodySecondary)
                }
            } else {
                ForEach(viewModel.notificationsFeed) { notification in
                    notificationCard(notification)
                }
            }
        }
    }

    private var notificationsListHeaderCard: some View {
        cardContainer {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(localizedKey(AccessL10nKey.homeShellNotifications))
                    .font(tokens.typography.titleCard)
                Text(localizedKey(AccessL10nKey.notificationsListSubtitle))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
                if currentHomeMember?.isAdmin == true {
                    ReguertaButton(localizedKey(AccessL10nKey.notificationsCreateAction)) {
                        viewModel.startCreatingNotification()
                        homeDestination = .adminBroadcast
                    }
                }
                ReguertaButton(
                    localizedKey(AccessL10nKey.notificationsRefreshAction),
                    variant: .text
                ) {
                    viewModel.refreshNotifications()
                }
            }
        }
    }

    private func notificationCard(_ notification: NotificationEvent) -> some View {
        cardContainer {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(notification.title)
                    .font(tokens.typography.titleCard)
                Text(l10n(AccessL10nKey.notificationsMetaFormat, localizedDateTime(notification.sentAtMillis)))
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
                Text(notification.body)
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textPrimary)
                Text(localizedKey(notification.audienceTitleKey))
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.actionPrimary)
            }
        }
    }

    @ViewBuilder
    private var sharedProfileRoute: some View {
        if let session = currentHomeSession {
            SharedProfileHubRoute(
                session: session,
                profiles: viewModel.sharedProfiles,
                draft: Binding(
                    get: { viewModel.sharedProfileDraft },
                    set: { viewModel.sharedProfileDraft = $0 }
                ),
                isLoading: viewModel.isLoadingSharedProfiles,
                isSaving: viewModel.isSavingSharedProfile,
                isDeleting: viewModel.isDeletingSharedProfile,
                onRefresh: viewModel.refreshSharedProfiles,
                onSave: viewModel.saveSharedProfile,
                onDelete: viewModel.deleteSharedProfile,
                displayName: { displayName(for: $0, session: session) }
            )
        }
    }

    private struct SharedProfileHubRoute: View {
        let session: AuthorizedSession
        let profiles: [SharedProfile]
        @Binding var draft: SharedProfileDraft
        let isLoading: Bool
        let isSaving: Bool
        let isDeleting: Bool
        let onRefresh: () -> Void
        let onSave: (@escaping @MainActor () -> Void) -> Void
        let onDelete: (@escaping @MainActor () -> Void) -> Void
        let displayName: (String) -> String

        @Environment(\.reguertaTokens) private var tokens
        @State private var selectedProfileUserId: String?
        @State private var isEditingOwnProfile = false

        private var ownProfileExists: Bool {
            profiles.contains { $0.userId == session.member.id }
        }

        private var sortedProfiles: [SharedProfile] {
            profiles.sorted { displayName($0.userId) < displayName($1.userId) }
        }

        private var selectedProfile: SharedProfile? {
            sortedProfiles.first { $0.userId == selectedProfileUserId }
        }

        private func localizedKey(_ key: String) -> LocalizedStringKey {
            LocalizedStringKey(key)
        }

        var body: some View {
            if isEditingOwnProfile {
                editorView
            } else if let selectedProfile {
                detailView(for: selectedProfile)
            } else {
                listView
            }
        }

        private var listView: some View {
            VStack(alignment: .leading, spacing: tokens.spacing.lg) {
                ReguertaCard {
                    VStack(alignment: .leading, spacing: tokens.spacing.md) {
                        Text(localizedKey(AccessL10nKey.profileSharedHubTitle))
                            .font(tokens.typography.titleCard)
                        Text(localizedKey(AccessL10nKey.profileSharedHubSubtitle))
                            .font(tokens.typography.bodySecondary)
                            .foregroundStyle(tokens.colors.textSecondary)

                        ReguertaButton(
                            localizedKey(
                                ownProfileExists
                                ? AccessL10nKey.profileSharedActionViewMyProfile
                                : AccessL10nKey.profileSharedActionCreate
                            )
                        ) {
                            if ownProfileExists {
                                selectedProfileUserId = session.member.id
                            } else {
                                isEditingOwnProfile = true
                            }
                        }
                    }
                }

                ReguertaCard {
                    VStack(alignment: .leading, spacing: tokens.spacing.md) {
                        Text(localizedKey(AccessL10nKey.profileSharedCommunityTitle))
                            .font(tokens.typography.titleCard)
                        Text(localizedKey(AccessL10nKey.profileSharedCommunitySubtitle))
                            .font(tokens.typography.bodySecondary)
                            .foregroundStyle(tokens.colors.textSecondary)
                        ReguertaButton(localizedKey(AccessL10nKey.notificationsRefreshAction), variant: .text, fullWidth: false) {
                            onRefresh()
                        }

                        if isLoading {
                            Text(localizedKey(AccessL10nKey.profileSharedLoading))
                                .font(tokens.typography.bodySecondary)
                        } else if sortedProfiles.isEmpty {
                            Text(localizedKey(AccessL10nKey.profileSharedEmpty))
                                .font(tokens.typography.bodySecondary)
                        } else {
                            ForEach(sortedProfiles) { profile in
                                Button {
                                    selectedProfileUserId = profile.userId
                                } label: {
                                    HStack {
                                        VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                                            Text(displayName(profile.userId))
                                                .font(tokens.typography.bodySecondary.weight(.semibold))
                                            if !profile.familyNames.isEmpty {
                                                Text(profile.familyNames)
                                                    .font(tokens.typography.label)
                                            }
                                        }
                                        Spacer()
                                        Image(systemName: "chevron.right")
                                            .foregroundStyle(tokens.colors.textSecondary)
                                    }
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
            }
        }

        private func detailView(for profile: SharedProfile) -> some View {
            ReguertaCard {
                VStack(alignment: .leading, spacing: tokens.spacing.md) {
                    sharedProfileCard(profile)

                    if profile.userId == session.member.id {
                        ReguertaButton(localizedKey(AccessL10nKey.profileSharedActionEdit)) {
                            isEditingOwnProfile = true
                        }
                        ReguertaButton(
                            localizedKey(
                                isDeleting
                                ? AccessL10nKey.profileSharedActionDeleting
                                : AccessL10nKey.profileSharedActionDelete
                            ),
                            variant: .text,
                            isEnabled: !isDeleting
                        ) {
                            onDelete {
                                selectedProfileUserId = nil
                            }
                        }
                    }

                    ReguertaButton(localizedKey(AccessL10nKey.commonBack), variant: .text) {
                        selectedProfileUserId = nil
                    }
                }
            }
        }

        private var editorView: some View {
            ReguertaCard {
                VStack(alignment: .leading, spacing: tokens.spacing.md) {
                    Text(
                        localizedKey(
                            ownProfileExists
                            ? AccessL10nKey.profileSharedEditorTitleEdit
                            : AccessL10nKey.profileSharedEditorTitleCreate
                        )
                    )
                    .font(tokens.typography.titleCard)
                    Text(localizedKey(AccessL10nKey.profileSharedEditorSubtitle))
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)

                    TextField("", text: $draft.familyNames, prompt: Text(localizedKey(AccessL10nKey.profileSharedFamilyNamesLabel)))
                        .textFieldStyle(.roundedBorder)
                    TextField("", text: $draft.photoUrl, prompt: Text(localizedKey(AccessL10nKey.profileSharedPhotoURLLabel)))
                        .textFieldStyle(.roundedBorder)
                    Text(localizedKey(AccessL10nKey.profileSharedAboutLabel))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.textSecondary)
                    TextEditor(text: $draft.about)
                        .frame(minHeight: 160.resize)
                        .padding(tokens.spacing.sm)
                        .background(tokens.colors.surfaceSecondary)
                        .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))

                    ReguertaButton(
                        localizedKey(
                            isSaving
                            ? AccessL10nKey.profileSharedActionSaving
                            : (ownProfileExists
                                ? AccessL10nKey.profileSharedActionSave
                                : AccessL10nKey.profileSharedActionCreate)
                        ),
                        isEnabled: !isSaving,
                        isLoading: isSaving
                    ) {
                        onSave {
                            isEditingOwnProfile = false
                            selectedProfileUserId = nil
                        }
                    }
                    ReguertaButton(localizedKey(AccessL10nKey.commonBack), variant: .text) {
                        isEditingOwnProfile = false
                    }
                }
            }
        }

        private func sharedProfileCard(_ profile: SharedProfile) -> some View {
            HStack(alignment: .top, spacing: tokens.spacing.md) {
                profileAvatar(profile)

                VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                    Text(displayName(profile.userId))
                        .font(tokens.typography.bodySecondary.weight(.semibold))
                    if !profile.familyNames.isEmpty {
                        Text(profile.familyNames)
                            .font(tokens.typography.label)
                    }
                    if !profile.about.isEmpty {
                        Text(profile.about)
                            .font(tokens.typography.bodySecondary)
                            .foregroundStyle(tokens.colors.textPrimary)
                    }
                }

                Spacer(minLength: 0)
            }
            .padding(tokens.spacing.sm + 2)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(tokens.colors.surfaceSecondary)
            .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))
        }

        @ViewBuilder
        private func profileAvatar(_ profile: SharedProfile) -> some View {
            if let rawURL = profile.photoUrl, let url = URL(string: rawURL), !rawURL.isEmpty {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .empty:
                        avatarPlaceholder
                    case .success(let image):
                        image.resizable().scaledToFill()
                            .frame(width: 72.resize, height: 72.resize)
                            .clipShape(Circle())
                    case .failure:
                        avatarPlaceholder
                    @unknown default:
                        avatarPlaceholder
                    }
                }
            } else {
                avatarPlaceholder
            }
        }

        private var avatarPlaceholder: some View {
            Circle()
                .fill(tokens.colors.actionPrimary.opacity(0.14))
                .frame(width: 72.resize, height: 72.resize)
                .overlay {
                    Image(systemName: "person.fill")
                        .font(.system(size: 28.resize, weight: .semibold))
                        .foregroundStyle(tokens.colors.actionPrimary)
            }
        }
    }

    private var notificationEditorRoute: some View {
        cardContainer {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                Text(localizedKey(AccessL10nKey.notificationsEditorTitle))
                    .font(tokens.typography.titleCard)

                Text(localizedKey(AccessL10nKey.notificationsEditorSubtitle))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)

                TextField(
                    "",
                    text: notificationTitleBinding,
                    prompt: Text(localizedKey(AccessL10nKey.notificationsFieldTitle))
                )
                .textFieldStyle(.roundedBorder)

                Text(localizedKey(AccessL10nKey.notificationsFieldBody))
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
                TextEditor(text: notificationBodyBinding)
                    .frame(minHeight: 180.resize)
                    .padding(tokens.spacing.sm)
                    .background(tokens.colors.surfaceSecondary)
                    .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))

                Picker(localizedKey(AccessL10nKey.notificationsFieldAudience), selection: notificationAudienceBinding) {
                    ForEach(NotificationAudience.allCases, id: \.self) { audience in
                        Text(localizedKey(audience.titleKey)).tag(audience)
                    }
                }

                ReguertaButton(
                    localizedKey(
                        viewModel.isSendingNotification
                        ? AccessL10nKey.notificationsSendActionSending
                        : AccessL10nKey.notificationsSendActionSend
                    ),
                    isEnabled: !viewModel.isSendingNotification,
                    isLoading: viewModel.isSendingNotification
                ) {
                    viewModel.sendNotification {
                        homeDestination = .notifications
                    }
                }

                ReguertaButton(
                    localizedKey(AccessL10nKey.commonBack),
                    variant: .text
                ) {
                    viewModel.clearNotificationEditor()
                    homeDestination = .notifications
                }
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
        homeDrawerItem("person.3.fill", titleKey: AccessL10nKey.homeShellActionProfile, destination: .profile)
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
            if destination == .adminBroadcast {
                viewModel.startCreatingNotification()
            }
            if destination == .news {
                viewModel.refreshNews()
            }
            if destination == .notifications {
                viewModel.refreshNotifications()
            }
            if destination == .profile {
                viewModel.refreshSharedProfiles()
            }
            if destination == .shifts {
                viewModel.refreshShifts()
            }
            if destination == .settings {
                viewModel.refreshDeliveryCalendar()
            }
            homeDestination = destination
            closeHomeDrawer()
        }
    }

    @ViewBuilder
    private var settingsRoute: some View {
        cardContainer {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                Text("Ajustes")
                    .font(tokens.typography.titleSection)
                    .foregroundStyle(tokens.colors.textPrimary)
                Text("La impersonacion solo aparece en develop para probar flujos con otros socios sin salir de tu sesion real.")
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)

                if viewModel.isDevelopImpersonationEnabled, let session = currentHomeSession {
                    let isImpersonating = session.member.id != session.authenticatedMember.id
                    Text("Cuenta real: \(session.authenticatedMember.displayName)")
                        .font(tokens.typography.body.weight(.semibold))
                        .foregroundStyle(tokens.colors.textPrimary)
                    Text(
                        isImpersonating
                        ? "Viendo la app como: \(session.member.displayName)"
                        : "Ahora mismo estas usando tu propio perfil."
                    )
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)

                    if isImpersonating {
                        ReguertaButton("Volver a mi perfil real") {
                            viewModel.clearImpersonation()
                        }
                    }

                    Divider()
                        .overlay(tokens.colors.borderSubtle)

                    Text("Impersonacion develop")
                        .font(tokens.typography.titleCard)
                        .foregroundStyle(tokens.colors.textPrimary)

                    ForEach(
                        session.members
                            .filter(\.isActive)
                            .sorted { $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending },
                        id: \.id
                    ) { member in
                        ReguertaButton(LocalizedStringKey(member.displayName), variant: .text) {
                            viewModel.impersonate(memberId: member.id)
                        }
                        .disabled(member.id == session.member.id)
                    }
                }

                if let session = currentHomeSession, session.member.isAdmin {
                    Divider()
                        .overlay(tokens.colors.borderSubtle)
                    adminDeliveryCalendarSection(session: session)
                }
            }
        }
    }

    @ViewBuilder
    private func adminDeliveryCalendarSection(session: AuthorizedSession) -> some View {
        let futureWeeks = viewModel.shiftsFeed
            .filter { $0.type == .delivery && $0.dateMillis > Int64(Date().timeIntervalSince1970 * 1000) }
            .sorted { $0.dateMillis < $1.dateMillis }
            .uniqued { $0.weekKey }

        Text("Calendario de reparto")
            .font(tokens.typography.titleCard)
            .foregroundStyle(tokens.colors.textPrimary)
        Text("Gestiona excepciones por semana. Si quitas una excepcion, la semana vuelve al dia por defecto.")
            .font(tokens.typography.bodySecondary)
            .foregroundStyle(tokens.colors.textSecondary)
        Text("Dia por defecto: \(viewModel.defaultDeliveryDayOfWeek?.spanishLabel ?? "sin configurar")")
            .font(tokens.typography.body.weight(.semibold))
            .foregroundStyle(tokens.colors.textPrimary)
        ReguertaButton("Recargar calendario", variant: .text, fullWidth: false) {
            viewModel.refreshDeliveryCalendar()
        }

        if viewModel.isLoadingDeliveryCalendar {
            Text("Cargando calendario…")
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.textSecondary)
        } else if futureWeeks.isEmpty {
            Text("No hay semanas de reparto futuras en los turnos cargados.")
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.textSecondary)
        } else {
            ForEach(futureWeeks, id: \.id) { shift in
                let existingOverride = viewModel.deliveryCalendarOverrides.first(where: { $0.weekKey == shift.weekKey })
                DeliveryCalendarWeekCard(
                    shift: shift,
                    overrideEntry: existingOverride,
                    defaultDay: viewModel.defaultDeliveryDayOfWeek ?? .wednesday,
                    isSaving: viewModel.isSavingDeliveryCalendar,
                    onSave: { weekKey, weekday in
                        viewModel.saveDeliveryCalendarOverride(
                            weekKey: weekKey,
                            weekday: weekday,
                            updatedByUserId: session.member.id
                        )
                    },
                    onDelete: { weekKey in
                        viewModel.deleteDeliveryCalendarOverride(weekKey: weekKey)
                    }
                )
            }
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

    private struct DeliveryCalendarWeekCard: View {
        @Environment(\.reguertaTokens) private var tokens
        let shift: ShiftAssignment
        let overrideEntry: DeliveryCalendarOverride?
        let defaultDay: DeliveryWeekday
        let isSaving: Bool
        let onSave: (String, DeliveryWeekday) -> Void
        let onDelete: (String) -> Void
        @State private var selectedWeekday: DeliveryWeekday

        init(
            shift: ShiftAssignment,
            overrideEntry: DeliveryCalendarOverride?,
            defaultDay: DeliveryWeekday,
            isSaving: Bool,
            onSave: @escaping (String, DeliveryWeekday) -> Void,
            onDelete: @escaping (String) -> Void
        ) {
            self.shift = shift
            self.overrideEntry = overrideEntry
            self.defaultDay = defaultDay
            self.isSaving = isSaving
            self.onSave = onSave
            self.onDelete = onDelete
            _selectedWeekday = State(initialValue: overrideEntry?.deliveryDateMillis.deliveryWeekday ?? defaultDay)
        }

        var body: some View {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(shift.weekKey)
                    .font(tokens.typography.body.weight(.semibold))
                Text("Turno cargado: \(localizedDateOnly(shift.dateMillis))")
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
                Text(
                    overrideEntry.map { "Excepcion activa: \(localizedDateOnly($0.deliveryDateMillis))" } ??
                    "Sin excepcion. Aplica el dia por defecto."
                )
                .font(tokens.typography.label)
                .foregroundStyle(tokens.colors.textSecondary)
                HStack(spacing: tokens.spacing.sm) {
                    ReguertaButton("Anterior", variant: .text, fullWidth: false) {
                        selectedWeekday = selectedWeekday.previous
                    }
                    Text(selectedWeekday.spanishLabel)
                        .font(tokens.typography.bodySecondary.weight(.semibold))
                    ReguertaButton("Siguiente", variant: .text, fullWidth: false) {
                        selectedWeekday = selectedWeekday.next
                    }
                }
                ReguertaButton("Guardar excepcion", isEnabled: !isSaving, isLoading: isSaving) {
                    onSave(shift.weekKey, selectedWeekday)
                }
                if overrideEntry != nil {
                    ReguertaButton("Quitar excepcion", variant: .text, isEnabled: !isSaving, fullWidth: false) {
                        onDelete(shift.weekKey)
                    }
                }
            }
            .padding(tokens.spacing.md)
            .background(tokens.colors.surfaceSecondary)
            .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))
        }

        private func localizedDateOnly(_ millis: Int64) -> String {
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "es_ES")
            formatter.dateFormat = "d MMM yyyy"
            return formatter.string(from: Date(timeIntervalSince1970: TimeInterval(millis) / 1_000))
        }
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

    private var notificationTitleBinding: Binding<String> {
        Binding(
            get: { viewModel.notificationDraft.title },
            set: { value in
                viewModel.updateNotificationDraft { $0.title = value }
            }
        )
    }

    private var notificationBodyBinding: Binding<String> {
        Binding(
            get: { viewModel.notificationDraft.body },
            set: { value in
                viewModel.updateNotificationDraft { $0.body = value }
            }
        )
    }

    private var notificationAudienceBinding: Binding<NotificationAudience> {
        Binding(
            get: { viewModel.notificationDraft.audience },
            set: { value in
                viewModel.updateNotificationDraft { $0.audience = value }
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

    private var currentHomeSession: AuthorizedSession? {
        switch viewModel.mode {
        case .authorized(let session):
            return session
        case .signedOut, .unauthorized:
            return nil
        }
    }

    private var pendingNewsDeletionArticle: NewsArticle? {
        guard let pendingNewsDeletionId else { return nil }
        return viewModel.newsFeed.first(where: { $0.id == pendingNewsDeletionId })
    }

    private func displayName(for userId: String, session: AuthorizedSession) -> String {
        session.members.first(where: { $0.id == userId })?.displayName ?? userId
    }

    private func memberNames(for userIds: [String]) -> String {
        guard let session = currentHomeSession else {
            return userIds.joined(separator: ", ")
        }
        let names = userIds.map { displayName(for: $0, session: session) }
        return names.isEmpty ? "—" : names.joined(separator: ", ")
    }

    private func shiftSummary(_ shift: ShiftAssignment) -> String {
        "\(localizedDateTime(shift.dateMillis)) · \(memberNames(for: shift.assignedUserIds))"
    }

    private func shiftSwapDisplayLabel(_ shift: ShiftAssignment, memberId: String?) -> String {
        localizedDateOnly(shift.dateMillis)
    }

    private func displayNameForSwap(_ userId: String) -> String {
        guard let session = currentHomeSession else { return userId }
        return displayName(for: userId, session: session)
    }

    private var shiftSwapCopy: ShiftSwapCopy {
        Locale.preferredLanguages.first?.hasPrefix("es") == true ? .spanish : .english
    }

    private func shiftSwapStatusLabel(_ status: ShiftSwapRequestStatus) -> String {
        switch status {
        case .open:
            return shiftSwapCopy.open
        case .cancelled:
            return shiftSwapCopy.cancelled
        case .applied:
            return shiftSwapCopy.applied
        }
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

    private func localizedDateTime(_ millis: Int64) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: Date(timeIntervalSince1970: TimeInterval(millis) / 1_000))
    }

    private func localizedDateOnly(_ millis: Int64) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "es_ES")
        formatter.dateFormat = "d MMM yyyy"
        return formatter.string(from: Date(timeIntervalSince1970: TimeInterval(millis) / 1_000))
    }
}

private enum HomeDestination: String, Sendable {
    case dashboard
    case myOrder
    case myOrders
    case shifts
    case shiftSwapRequest
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
        case .shiftSwapRequest: AccessL10nKey.shifts
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
        case .shiftSwapRequest: AccessL10nKey.homePlaceholderShifts
        case .news: AccessL10nKey.newsListSubtitle
        case .notifications: AccessL10nKey.notificationsListSubtitle
        case .profile: AccessL10nKey.homePlaceholderProfile
        case .settings: AccessL10nKey.homePlaceholderSettings
        case .products: AccessL10nKey.homePlaceholderProducts
        case .receivedOrders: AccessL10nKey.homePlaceholderReceivedOrders
        case .users: AccessL10nKey.homePlaceholderUsers
        case .publishNews: AccessL10nKey.newsEditorSubtitle
        case .adminBroadcast: AccessL10nKey.notificationsEditorSubtitle
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

private extension NotificationAudience {
    var titleKey: String {
        switch self {
        case .all:
            return AccessL10nKey.notificationsTargetAll
        case .members:
            return AccessL10nKey.notificationsTargetMembers
        case .producers:
            return AccessL10nKey.notificationsTargetProducers
        case .admins:
            return AccessL10nKey.notificationsTargetAdmins
        }
    }
}

private extension NotificationEvent {
    var audienceTitleKey: String {
        switch (target, segmentType, targetRole) {
        case ("all", _, _):
            return AccessL10nKey.notificationsTargetAll
        case ("users", _, _):
            return AccessL10nKey.notificationsTargetUsers
        case ("segment", "role"?, .member?):
            return AccessL10nKey.notificationsTargetMembers
        case ("segment", "role"?, .producer?):
            return AccessL10nKey.notificationsTargetProducers
        case ("segment", "role"?, .admin?):
            return AccessL10nKey.notificationsTargetAdmins
        default:
            return AccessL10nKey.notificationsTargetAll
        }
    }
}

private extension ShiftType {
    var titleKey: String {
        switch self {
        case .delivery:
            return AccessL10nKey.shiftsTypeDelivery
        case .market:
            return AccessL10nKey.shiftsTypeMarket
        }
    }
}

private enum ShiftBoardSegment: CaseIterable {
    case delivery
    case market

    var titleKey: String {
        switch self {
        case .delivery:
            return AccessL10nKey.shiftsTypeDelivery
        case .market:
            return AccessL10nKey.shiftsTypeMarket
        }
    }
}

private struct ShiftBoardLine {
    let text: String
    let font: Font
    let weight: Font.Weight
    let color: Color
}

private struct ShiftSwapCopy {
    let title: String
    let subtitle: String
    let requestsTitle: String
    let requestsSubtitle: String
    let empty: String
    let incoming: String
    let outgoing: String
    let history: String
    let reasonLabel: String
    let send: String
    let sending: String
    let back: String
    let cancel: String
    let confirm: String
    let acknowledge: String
    let noReason: String
    let responses: String
    let open: String
    let cancelled: String
    let applied: String
    let ask: String
    let deliveryLabel: String
    let marketLabel: String
    let acceptShort: String
    let rejectShort: String
    let shift: (String) -> String
    let broadcastScope: (String) -> String
    let requestedBy: (String) -> String
    let offerShift: (String) -> String
    let reason: (String) -> String
    let waitingMany: (Int) -> String
    let confirmBeforeAfter: (String, String) -> String
    let selected: (String) -> String

    static let spanish = ShiftSwapCopy(
        title: "Solicitar cambio de turno",
        subtitle: "Revisa el turno, difunde la solicitud a los socios que pueden cubrirlo y añade el motivo si quieres.",
        requestsTitle: "Solicitudes de cambio",
        requestsSubtitle: "Responde si puedes cubrir turnos ajenos o confirma con quién haces el intercambio.",
        empty: "Ahora mismo no tienes solicitudes de cambio.",
        incoming: "Te piden cambio",
        outgoing: "Tus solicitudes",
        history: "Actividad reciente",
        reasonLabel: "Motivo (opcional)",
        send: "Enviar solicitud",
        sending: "Enviando solicitud…",
        back: "Volver",
        cancel: "Cancelar solicitud",
        confirm: "Confirmar cambio",
        acknowledge: "Entendido",
        noReason: "Sin motivo adicional",
        responses: "Pueden cubrirlo",
        open: "Abierta",
        cancelled: "Cancelada",
        applied: "Aplicada",
        ask: "Solicitar cambio",
        deliveryLabel: "reparto",
        marketLabel: "mercadillo",
        acceptShort: "Puedo",
        rejectShort: "No puedo",
        shift: { "Turno: \($0)" },
        broadcastScope: { "Se enviará a los socios con turnos futuros de \($0)." },
        requestedBy: { "Solicita: \($0)" },
        offerShift: { "Tu turno para intercambiar: \($0)" },
        reason: { "Motivo: \($0)" },
        waitingMany: { "Enviada a \($0) socios. Esperando respuestas." },
        confirmBeforeAfter: { "Cambiar tu turno del \($0) por el turno del \($1)." },
        selected: { "Cambio confirmado con: \($0)" }
    )

    static let english = ShiftSwapCopy(
        title: "Request shift swap",
        subtitle: "Review the shift, broadcast the request to members who can cover it, and add a reason if needed.",
        requestsTitle: "Swap requests",
        requestsSubtitle: "Respond if you can cover shifts or confirm which accepted offer you want to apply.",
        empty: "You have no shift swap requests right now.",
        incoming: "Incoming requests",
        outgoing: "Your requests",
        history: "Recent activity",
        reasonLabel: "Reason (optional)",
        send: "Send request",
        sending: "Sending request…",
        back: "Back",
        cancel: "Cancel request",
        confirm: "Confirm change",
        acknowledge: "OK",
        noReason: "No extra reason",
        responses: "Available members",
        open: "Open",
        cancelled: "Cancelled",
        applied: "Applied",
        ask: "Request swap",
        deliveryLabel: "delivery",
        marketLabel: "market",
        acceptShort: "I can",
        rejectShort: "I can't",
        shift: { "Shift: \($0)" },
        broadcastScope: { "It will be sent to members with future \($0) shifts." },
        requestedBy: { "Requested by: \($0)" },
        offerShift: { "Your shift to swap: \($0)" },
        reason: { "Reason: \($0)" },
        waitingMany: { "Sent to \($0) members. Waiting for responses." },
        confirmBeforeAfter: { "Swap your shift on \($0) with the shift on \($1)." },
        selected: { "Confirmed with: \($0)" }
    )
}

private extension ShiftAssignment {
    var localDate: Date {
        Date(timeIntervalSince1970: TimeInterval(dateMillis) / 1_000)
    }

    func leftBoardLines(tokens: ReguertaDesignTokens) -> [ShiftBoardLine] {
        switch type {
        case .delivery:
            return [
                ShiftBoardLine(
                    text: weekKey,
                    font: tokens.typography.label,
                    weight: .semibold,
                    color: tokens.colors.textPrimary
                ),
                ShiftBoardLine(
                    text: boardDateLabel,
                    font: tokens.typography.bodySecondary,
                    weight: .regular,
                    color: tokens.colors.textSecondary
                ),
            ]
        case .market:
            let monthFormatter = DateFormatter()
            monthFormatter.locale = Locale(identifier: "es_ES")
            monthFormatter.dateFormat = "LLLL"
            let weekdayFormatter = DateFormatter()
            weekdayFormatter.locale = Locale(identifier: "es_ES")
            weekdayFormatter.dateFormat = "EEEE"
            return [
                ShiftBoardLine(
                    text: monthFormatter.string(from: localDate).capitalized,
                    font: tokens.typography.bodySecondary,
                    weight: .semibold,
                    color: tokens.colors.textPrimary
                ),
                ShiftBoardLine(
                    text: weekdayFormatter.string(from: localDate).capitalized,
                    font: tokens.typography.label,
                    weight: .regular,
                    color: tokens.colors.textSecondary
                ),
                ShiftBoardLine(
                    text: dayNumberLabel,
                    font: tokens.typography.titleCard,
                    weight: .semibold,
                    color: tokens.colors.textPrimary
                ),
            ]
        }
    }

    func boardNames(session: AuthorizedSession?) -> [String] {
        switch type {
        case .delivery:
            var names: [String] = []
            if let firstAssigned = assignedUserIds.first {
                names.append(displayName(for: firstAssigned, session: session))
            }
            names.append(
                helperUserId.map { displayName(for: $0, session: session) } ?? "—"
            )
            return names.isEmpty ? ["—", "—"] : names
        case .market:
            let names = assignedUserIds.map { displayName(for: $0, session: session) }
            if names.isEmpty {
                return ["—", "—", "—"]
            }
            return Array((names + Array(repeating: "—", count: max(0, 3 - names.count))).prefix(3))
        }
    }

    func canBeRequested(by currentMemberId: String) -> Bool {
        switch type {
        case .delivery:
            return dateMillis > Int64(Date().timeIntervalSince1970 * 1_000) &&
                assignedUserIds.first == currentMemberId
        case .market:
            return dateMillis > Int64(Date().timeIntervalSince1970 * 1_000) &&
                assignedUserIds.contains(currentMemberId)
        }
    }

    func highlightedBoardNameIndex(for currentMemberId: String) -> Int? {
        switch type {
        case .delivery:
            if assignedUserIds.first == currentMemberId {
                return 0
            }
            if helperUserId == currentMemberId {
                return 1
            }
            return nil
        case .market:
            let index = assignedUserIds.firstIndex(of: currentMemberId)
            return index.map { min($0, 2) }
        }
    }

    var weekKey: String {
        let calendar = Calendar(identifier: .iso8601)
        let week = calendar.component(.weekOfYear, from: localDate)
        let year = calendar.component(.yearForWeekOfYear, from: localDate)
        return String(format: "%04d-W%02d", year, week)
    }

    private var boardDateLabel: String {
        let weekdayFormatter = DateFormatter()
        weekdayFormatter.locale = Locale(identifier: "es_ES")
        weekdayFormatter.dateFormat = "EEE"
        let weekday = weekdayFormatter.string(from: localDate)
            .replacingOccurrences(of: ".", with: "")
            .capitalized
        return "\(weekday) \(dayNumberLabel) \(shortMonthLabel)"
    }

    private var shortMonthLabel: String {
        let month = Calendar(identifier: .iso8601).component(.month, from: localDate)
        switch month {
        case 1: return "ene"
        case 2: return "feb"
        case 3: return "mar"
        case 4: return "abr"
        case 5: return "may"
        case 6: return "jun"
        case 7: return "jul"
        case 8: return "ago"
        case 9: return "sep"
        case 10: return "oct"
        case 11: return "nov"
        case 12: return "dic"
        default: return ""
        }
    }

    private var dayNumberLabel: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "es_ES")
        formatter.dateFormat = "d"
        return formatter.string(from: localDate)
    }

    private func displayName(for memberId: String, session: AuthorizedSession?) -> String {
        session?.members.first(where: { $0.id == memberId })?.displayName ?? memberId
    }
}

private extension ShiftSwapRequest {
    var availableResponses: [ShiftSwapResponse] {
        responses.filter { $0.status == .available }
    }
}

private extension DeliveryWeekday {
    var spanishLabel: String {
        switch self {
        case .monday: "Lunes"
        case .tuesday: "Martes"
        case .wednesday: "Miercoles"
        case .thursday: "Jueves"
        case .friday: "Viernes"
        case .saturday: "Sabado"
        case .sunday: "Domingo"
        }
    }

    var previous: DeliveryWeekday {
        let all = DeliveryWeekday.allCases
        return all[(all.firstIndex(of: self)! + all.count - 1) % all.count]
    }

    var next: DeliveryWeekday {
        let all = DeliveryWeekday.allCases
        return all[(all.firstIndex(of: self)! + 1) % all.count]
    }
}

private extension Int64 {
    var deliveryWeekday: DeliveryWeekday {
        let weekday = Calendar.current.component(.weekday, from: Date(timeIntervalSince1970: TimeInterval(self) / 1_000))
        switch weekday {
        case 2: return .monday
        case 3: return .tuesday
        case 4: return .wednesday
        case 5: return .thursday
        case 6: return .friday
        case 7: return .saturday
        default: return .sunday
        }
    }
}

private extension Array {
    func uniqued<Key: Hashable>(by keyPath: (Element) -> Key) -> [Element] {
        var seen = Set<Key>()
        return filter { seen.insert(keyPath($0)).inserted }
    }
}

private extension ShiftStatus {
    var titleKey: String {
        switch self {
        case .planned:
            return AccessL10nKey.shiftsStatusPlanned
        case .swapPending:
            return AccessL10nKey.shiftsStatusSwapPending
        case .confirmed:
            return AccessL10nKey.shiftsStatusConfirmed
        }
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
