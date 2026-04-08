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
    @State private var pendingProducerCatalogVisibility: Bool?
    @State private var selectedShiftSegment: ShiftBoardSegment = .delivery
    @State private var isDeliveryCalendarEditorPresented = false
    @State private var isDeliveryCalendarWeekPickerPresented = false
    @State private var selectedDeliveryCalendarWeekKey: String?
    @State private var isImpersonationExpanded = false
    @State private var pendingShiftPlanningType: ShiftPlanningRequestType?

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
        case .products:
            productsRoute
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
        HomeShellTopBarView(
            tokens: tokens,
            titleKey: homeDestination.titleKey,
            showsBack: homeDestination != .dashboard,
            onPrimaryAction: {
                if homeDestination == .dashboard {
                    openHomeDrawer()
                } else if homeDestination == .publishNews {
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
            },
            onNotificationsAction: {
                homeDestination = .notifications
                viewModel.refreshNotifications()
            }
        )
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
            canOpenProducts: session.member.canManageProductCatalog,
            myOrderFreshnessState: viewModel.myOrderFreshnessState
        )

        if session.member.isAdmin {
            adminToolsCard(session: session)
        }
    }

    private var nextShiftsCard: some View {
        NextShiftsCardView(
            tokens: tokens,
            isLoading: viewModel.isLoadingShifts,
            nextDeliverySummary: viewModel.nextDeliveryShift.map(shiftSummary) ?? l10n(AccessL10nKey.shiftsNextPending),
            nextMarketSummary: viewModel.nextMarketShift.map(shiftSummary) ?? l10n(AccessL10nKey.shiftsNextPending),
            onViewAll: {
                homeDestination = .shifts
                viewModel.refreshShifts()
            }
        )
    }

    private var latestNewsCard: some View {
        LatestNewsCardView(
            tokens: tokens,
            latestNews: viewModel.latestNews,
            onViewAll: {
                homeDestination = .news
                viewModel.refreshNews()
            }
        )
    }

    @ViewBuilder
    private func operationalModules(
        modulesEnabled: Bool,
        canOpenProducts: Bool,
        myOrderFreshnessState: MyOrderFreshnessState,
        disabledMessageKey: String? = nil
    ) -> some View {
        OperationalModulesCardView(
            tokens: tokens,
            modulesEnabled: modulesEnabled,
            canOpenProducts: canOpenProducts,
            myOrderFreshnessState: myOrderFreshnessState,
            disabledMessageKey: disabledMessageKey,
            onOpenMyOrder: {},
            onOpenProducts: {
                homeDestination = .products
                viewModel.refreshProducts()
            },
            onOpenShifts: {
                homeDestination = .shifts
                viewModel.refreshShifts()
            },
            onRetryFreshness: {
                viewModel.refreshMyOrderFreshness()
            }
        )
    }

    @ViewBuilder
    private var shiftsRoute: some View {
        ShiftsRouteView(
            tokens: tokens,
            selectedShiftSegment: $selectedShiftSegment,
            isLoadingShifts: viewModel.isLoadingShifts,
            shiftsFeed: viewModel.shiftsFeed,
            shiftSwapRequests: viewModel.shiftSwapRequests,
            dismissedShiftSwapRequestIds: viewModel.dismissedShiftSwapRequestIds,
            currentMemberId: currentHomeMember?.id,
            currentSession: currentHomeSession,
            shiftSwapCopy: shiftSwapCopy,
            nextShiftsIsLoading: viewModel.isLoadingShifts,
            nextDeliverySummary: viewModel.nextDeliveryShift.map(shiftSummary) ?? l10n(AccessL10nKey.shiftsNextPending),
            nextMarketSummary: viewModel.nextMarketShift.map(shiftSummary) ?? l10n(AccessL10nKey.shiftsNextPending),
            onRefreshShifts: viewModel.refreshShifts,
            onRefreshFromNextShifts: {
                homeDestination = .shifts
                viewModel.refreshShifts()
            },
            onStartSwapRequestForShift: { shiftId in
                viewModel.startCreatingShiftSwap(shiftId: shiftId)
                homeDestination = .shiftSwapRequest
            },
            onAcceptIncomingCandidate: { requestId, candidateShiftId in
                viewModel.acceptShiftSwapRequest(requestId: requestId, candidateShiftId: candidateShiftId)
            },
            onRejectIncomingCandidate: { requestId, candidateShiftId in
                viewModel.rejectShiftSwapRequest(requestId: requestId, candidateShiftId: candidateShiftId)
            },
            onConfirmResponse: { requestId, candidateShiftId in
                viewModel.confirmShiftSwapRequest(requestId: requestId, candidateShiftId: candidateShiftId)
            },
            onCancelOwnRequest: { requestId in
                viewModel.cancelShiftSwapRequest(requestId: requestId)
            },
            onDismissAppliedRequest: { requestId in
                viewModel.dismissShiftSwapActivity(requestId: requestId)
            },
            shiftBoardLines: shiftLeftBoardLines,
            shiftSwapDisplayLabel: shiftSwapDisplayLabel,
            displayNameForSwap: displayNameForSwap,
            shiftSwapStatusLabel: shiftSwapStatusLabel,
            canRequestSwapForShift: canRequestSwapForShift
        )
    }

    private var shiftSwapRequestRoute: some View {
        let shift = viewModel.shiftsFeed.first(where: { $0.id == viewModel.shiftSwapDraft.shiftId })
        let shiftDisplayLabel = shift.map {
            shiftSwapDisplayLabel($0, memberId: $0.assignedUserIds.first ?? $0.helperUserId)
        } ?? viewModel.shiftSwapDraft.shiftId

        return ShiftSwapRequestRouteView(
            tokens: tokens,
            shift: shift,
            shiftSwapDraftShiftId: viewModel.shiftSwapDraft.shiftId,
            shiftSwapReason: Binding(
                get: { viewModel.shiftSwapDraft.reason },
                set: { newValue in
                    viewModel.updateShiftSwapDraft { $0.reason = newValue }
                }
            ),
            isSavingShiftSwapRequest: viewModel.isSavingShiftSwapRequest,
            shiftSwapCopy: shiftSwapCopy,
            shiftDisplayLabel: shiftDisplayLabel,
            onSave: {
                viewModel.saveShiftSwapRequest {
                    homeDestination = .shifts
                }
            },
            onBack: {
                viewModel.clearShiftSwapDraft()
                homeDestination = .shifts
            }
        )
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
        NewsListRouteView(
            tokens: tokens,
            isLoadingNews: viewModel.isLoadingNews,
            newsFeed: viewModel.newsFeed,
            isAdmin: currentHomeMember?.isAdmin == true,
            newsMetaText: { article in
                l10n(AccessL10nKey.newsMetaFormat, article.publishedBy)
            },
            onCreateNews: {
                viewModel.startCreatingNews()
                homeDestination = .publishNews
            },
            onRefreshNews: viewModel.refreshNews,
            onEditNews: { newsId in
                viewModel.startEditingNews(newsId: newsId)
                homeDestination = .publishNews
            },
            onDeleteNews: { newsId in
                pendingNewsDeletionId = newsId
            }
        )
    }

    private var newsEditorRoute: some View {
        NewsEditorRouteView(
            tokens: tokens,
            editingNewsId: viewModel.editingNewsId,
            newsTitle: newsTitleBinding,
            newsUrlImage: newsUrlImageBinding,
            newsBody: newsBodyBinding,
            newsActive: newsActiveBinding,
            isSavingNews: viewModel.isSavingNews,
            onSave: {
                viewModel.saveNews {
                    homeDestination = .news
                }
            },
            onBack: {
                viewModel.clearNewsEditor()
                homeDestination = .news
            }
        )
    }

    private var productsRoute: some View {
        ProductsRouteView(
            tokens: tokens,
            viewModel: viewModel,
            currentHomeMember: currentHomeMember,
            pendingProducerCatalogVisibility: $pendingProducerCatalogVisibility
        )
    }

    private var notificationsListRoute: some View {
        NotificationsListRouteView(
            tokens: tokens,
            isLoadingNotifications: viewModel.isLoadingNotifications,
            notificationsFeed: viewModel.notificationsFeed,
            isAdmin: currentHomeMember?.isAdmin == true,
            notificationMetaText: { notification in
                l10n(
                    AccessL10nKey.notificationsMetaFormat,
                    localizedDateTime(notification.sentAtMillis)
                )
            },
            onCreateNotification: {
                viewModel.startCreatingNotification()
                homeDestination = .adminBroadcast
            },
            onRefreshNotifications: viewModel.refreshNotifications
        )
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

    private var notificationEditorRoute: some View {
        NotificationEditorRouteView(
            tokens: tokens,
            notificationTitle: notificationTitleBinding,
            notificationBody: notificationBodyBinding,
            notificationAudience: notificationAudienceBinding,
            isSendingNotification: viewModel.isSendingNotification,
            onSend: {
                viewModel.sendNotification {
                    homeDestination = .notifications
                }
            },
            onBack: {
                viewModel.clearNotificationEditor()
                homeDestination = .notifications
            }
        )
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
            HomeDrawerContentView(
                tokens: tokens,
                currentMember: currentHomeMember,
                currentDestination: homeDestination,
                installedVersion: installedVersion,
                onNavigate: { destination in
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
                    if destination == .products {
                        viewModel.refreshProducts()
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
                },
                onCloseDrawer: closeHomeDrawer,
                onSignOut: {
                    closeHomeDrawer()
                    homeDestination = .dashboard
                    viewModel.signOut()
                    dispatchShell(.signedOut)
                }
            )
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
                    ReguertaButton(isImpersonationExpanded ? "Ocultar socios" : "Elegir socio", variant: .text) {
                        isImpersonationExpanded.toggle()
                    }
                    if isImpersonationExpanded {
                        ForEach(
                            session.members
                                .filter(\.isActive)
                                .sorted { $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending },
                            id: \.id
                        ) { member in
                            ReguertaButton(LocalizedStringKey(member.displayName), variant: .text) {
                                viewModel.impersonate(memberId: member.id)
                                isImpersonationExpanded = false
                            }
                            .disabled(member.id == session.member.id)
                        }
                    }
                }

                if let session = currentHomeSession, session.member.isAdmin {
                    Divider()
                        .overlay(tokens.colors.borderSubtle)
                    adminDeliveryCalendarSection(session: session)
                    Divider()
                        .overlay(tokens.colors.borderSubtle)
                    adminShiftPlanningSection(session: session)
                }
            }
        }
    }

    @ViewBuilder
    private func adminDeliveryCalendarSection(session: AuthorizedSession) -> some View {
        let futureWeeks = viewModel.shiftsFeed
            .filter { $0.type == .delivery && effectiveDateMillis(for: $0) > Int64(Date().timeIntervalSince1970 * 1000) }
            .sorted { effectiveDateMillis(for: $0) < effectiveDateMillis(for: $1) }
            .uniqued { $0.weekKey }
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            Text("Calendario de reparto")
                .font(tokens.typography.titleCard)
                .foregroundStyle(tokens.colors.textPrimary)
            Text("Dia por defecto: \(viewModel.defaultDeliveryDayOfWeek?.spanishLabel ?? "sin configurar")")
                .font(tokens.typography.body.weight(.semibold))
                .foregroundStyle(tokens.colors.textPrimary)

            if viewModel.isLoadingDeliveryCalendar {
                Text("Cargando calendario…")
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
            } else if futureWeeks.isEmpty {
                Text("No hay semanas de reparto futuras en los turnos cargados.")
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
            } else {
                HStack(spacing: tokens.spacing.sm) {
                    ReguertaButton("Cambiar dia de reparto", fullWidth: false) {
                        isDeliveryCalendarWeekPickerPresented = true
                    }
                    ReguertaButton("Recargar", variant: .text, fullWidth: false) {
                        viewModel.refreshDeliveryCalendar()
                    }
                }
                Text("Primero eliges la semana a cambiar y despues editas solo esa excepcion.")
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
            }
        }
        .sheet(isPresented: $isDeliveryCalendarWeekPickerPresented) {
            DeliveryCalendarWeekPickerSheet(
                futureWeeks: futureWeeks,
                overrides: viewModel.deliveryCalendarOverrides,
                onSelectWeek: { weekKey in
                    selectedDeliveryCalendarWeekKey = weekKey
                    isDeliveryCalendarWeekPickerPresented = false
                    isDeliveryCalendarEditorPresented = true
                }
            )
            .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $isDeliveryCalendarEditorPresented, onDismiss: {
            selectedDeliveryCalendarWeekKey = nil
        }) {
            if let weekKey = selectedDeliveryCalendarWeekKey,
               let shift = futureWeeks.first(where: { $0.weekKey == weekKey }) {
                DeliveryCalendarEditorSheet(
                    shift: shift,
                    overrideEntry: viewModel.deliveryCalendarOverrides.first(where: { $0.weekKey == weekKey }),
                    defaultDay: viewModel.defaultDeliveryDayOfWeek ?? .wednesday,
                    isSaving: viewModel.isSavingDeliveryCalendar,
                    onRefresh: { viewModel.refreshDeliveryCalendar() },
                    onSave: { selectedWeekKey, weekday in
                        viewModel.saveDeliveryCalendarOverride(
                            weekKey: selectedWeekKey,
                            weekday: weekday,
                            updatedByUserId: session.member.id
                        )
                    },
                    onDelete: { selectedWeekKey in
                        viewModel.deleteDeliveryCalendarOverride(weekKey: selectedWeekKey)
                    }
                )
                .presentationDetents([.medium, .large])
            }
        }
    }

    @ViewBuilder
    private func adminShiftPlanningSection(session: AuthorizedSession) -> some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            Text("Planificacion de turnos")
                .font(tokens.typography.titleCard)
                .foregroundStyle(tokens.colors.textPrimary)
            Text("Genera una temporada nueva con socios activos, escribe la hoja nueva y avisa a los socios asignados.")
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.textSecondary)
            HStack(spacing: tokens.spacing.sm) {
                ReguertaButton("Generar reparto", fullWidth: false) {
                    pendingShiftPlanningType = .delivery
                }
                ReguertaButton("Generar mercado", fullWidth: false) {
                    pendingShiftPlanningType = .market
                }
            }
            .disabled(viewModel.isSubmittingShiftPlanningRequest)
            if viewModel.isSubmittingShiftPlanningRequest {
                Text("Enviando solicitud de planificacion…")
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
            }
        }
        .alert(
            pendingShiftPlanningType == nil
                ? ""
                : "Generar turnos de \(pendingShiftPlanningType == .delivery ? "reparto" : "mercado")",
            isPresented: Binding(
                get: { pendingShiftPlanningType != nil },
                set: { presented in
                    if !presented {
                        pendingShiftPlanningType = nil
                    }
                }
            ),
            presenting: pendingShiftPlanningType
        ) { type in
            Button("Cancelar", role: .cancel) {
                pendingShiftPlanningType = nil
            }
            Button("Confirmar") {
                viewModel.submitShiftPlanningRequest(type: type) {
                    pendingShiftPlanningType = nil
                }
            }
        } message: { _ in
            Text("Se creara una planificacion nueva con socios activos, se escribira en la sheet de la temporada siguiente y se notificara a los socios asignados. Si vuelves a lanzarlo, se regenerara esa temporada.")
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

    private func deliveryOverride(for shift: ShiftAssignment) -> DeliveryCalendarOverride? {
        guard shift.type == .delivery else { return nil }
        return viewModel.deliveryCalendarOverrides.first(where: { $0.weekKey == shift.weekKey })
    }

    private func effectiveDateMillis(for shift: ShiftAssignment) -> Int64 {
        deliveryOverride(for: shift)?.deliveryDateMillis ?? shift.dateMillis
    }

    private func effectiveDate(for shift: ShiftAssignment) -> Date {
        Date(timeIntervalSince1970: TimeInterval(effectiveDateMillis(for: shift)) / 1_000)
    }

    private func localizedEffectiveDateTime(_ shift: ShiftAssignment) -> String {
        localizedDateTime(effectiveDateMillis(for: shift))
    }

    private func localizedEffectiveDateOnly(_ shift: ShiftAssignment) -> String {
        localizedDateOnly(effectiveDateMillis(for: shift))
    }

    private func shiftLeftBoardLines(_ shift: ShiftAssignment) -> [ShiftBoardLine] {
        switch shift.type {
        case .delivery:
            return [
                ShiftBoardLine(
                    text: effectiveDateMillis(for: shift).isoWeekKey,
                    font: tokens.typography.label,
                    weight: .semibold,
                    color: tokens.colors.textPrimary
                ),
                ShiftBoardLine(
                    text: effectiveDate(for: shift).boardDateLabel,
                    font: tokens.typography.bodySecondary,
                    weight: .regular,
                    color: tokens.colors.textSecondary
                ),
            ]
        case .market:
            let date = effectiveDate(for: shift)
            let monthFormatter = DateFormatter()
            monthFormatter.locale = Locale(identifier: "es_ES")
            monthFormatter.dateFormat = "LLLL"
            let weekdayFormatter = DateFormatter()
            weekdayFormatter.locale = Locale(identifier: "es_ES")
            weekdayFormatter.dateFormat = "EEEE"
            return [
                ShiftBoardLine(
                    text: monthFormatter.string(from: date).capitalized,
                    font: tokens.typography.bodySecondary,
                    weight: .semibold,
                    color: tokens.colors.textPrimary
                ),
                ShiftBoardLine(
                    text: weekdayFormatter.string(from: date).capitalized,
                    font: tokens.typography.label,
                    weight: .regular,
                    color: tokens.colors.textSecondary
                ),
                ShiftBoardLine(
                    text: date.dayNumberLabel,
                    font: tokens.typography.titleCard,
                    weight: .semibold,
                    color: tokens.colors.textPrimary
                ),
            ]
        }
    }

    private func canRequestSwapForShift(_ shift: ShiftAssignment, currentMemberId: String) -> Bool {
        let effectiveMillis = effectiveDateMillis(for: shift)
        switch shift.type {
        case .delivery:
            return effectiveMillis > Int64(Date().timeIntervalSince1970 * 1_000) &&
                shift.assignedUserIds.first == currentMemberId
        case .market:
            return effectiveMillis > Int64(Date().timeIntervalSince1970 * 1_000) &&
                shift.assignedUserIds.contains(currentMemberId)
        }
    }

    private func memberNames(for userIds: [String]) -> String {
        guard let session = currentHomeSession else {
            return userIds.joined(separator: ", ")
        }
        let names = userIds.map { displayName(for: $0, session: session) }
        return names.isEmpty ? "—" : names.joined(separator: ", ")
    }

    private func shiftSummary(_ shift: ShiftAssignment) -> String {
        "\(localizedEffectiveDateTime(shift)) · \(memberNames(for: shift.assignedUserIds))"
    }

    private func shiftSwapDisplayLabel(_ shift: ShiftAssignment, memberId: String?) -> String {
        localizedEffectiveDateOnly(shift)
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

    var canManageProductCatalog: Bool {
        isProducer || isCommonPurchaseManager
    }
}

extension NotificationAudience {
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

extension NotificationEvent {
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

enum ShiftBoardSegment: CaseIterable {
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

struct ShiftBoardLine {
    let text: String
    let font: Font
    let weight: Font.Weight
    let color: Color
}

struct ShiftSwapCopy {
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

extension ShiftAssignment {
    private var localDate: Date {
        Date(timeIntervalSince1970: TimeInterval(dateMillis) / 1_000)
    }

    fileprivate func leftBoardLines(tokens: ReguertaDesignTokens) -> [ShiftBoardLine] {
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

    fileprivate func canBeRequested(by currentMemberId: String) -> Bool {
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

extension ShiftSwapRequest {
    var availableResponses: [ShiftSwapResponse] {
        responses.filter { $0.status == .available }
    }
}

extension DeliveryWeekday {
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

extension Int64 {
    var isoWeekKey: String {
        let calendar = Calendar(identifier: .iso8601)
        let date = Date(timeIntervalSince1970: TimeInterval(self) / 1_000)
        let week = calendar.component(.weekOfYear, from: date)
        let year = calendar.component(.yearForWeekOfYear, from: date)
        return String(format: "%04d-W%02d", year, week)
    }

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

private extension Date {
    var boardDateLabel: String {
        let weekdayFormatter = DateFormatter()
        weekdayFormatter.locale = Locale(identifier: "es_ES")
        weekdayFormatter.dateFormat = "EEE"
        let weekday = weekdayFormatter.string(from: self)
            .replacingOccurrences(of: ".", with: "")
            .capitalized
        return "\(weekday) \(dayNumberLabel) \(shortMonthLabel)"
    }

    var shortMonthLabel: String {
        let month = Calendar(identifier: .iso8601).component(.month, from: self)
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

    var dayNumberLabel: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "es_ES")
        formatter.dateFormat = "d"
        return formatter.string(from: self)
    }
}

private extension Array {
    func uniqued<Key: Hashable>(by keyPath: (Element) -> Key) -> [Element] {
        var seen = Set<Key>()
        return filter { seen.insert(keyPath($0)).inserted }
    }
}

extension ShiftStatus {
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
