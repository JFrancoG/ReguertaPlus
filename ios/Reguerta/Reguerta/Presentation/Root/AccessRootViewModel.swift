import SwiftUI

private struct RootFeatureViewModels {
    let productsViewModel: ProductsRouteViewModel
    let shiftsViewModel: ShiftsFeatureViewModel
    let newsNotificationsViewModel: NewsNotificationsFeatureViewModel
    let sharedProfileViewModel: SharedProfileFeatureViewModel
    let usersViewModel: UsersFeatureViewModel
    let myOrderViewModel: MyOrderRouteViewModel
    let receivedOrdersViewModel: ReceivedOrdersRouteViewModel
    let myOrderFreshnessViewModel: MyOrderFreshnessViewModel
    let bylawsViewModel: BylawsFeatureViewModel
}

private struct RootFeatureDependencies {
    let products: ProductsFeatureDependencies
    let orders: OrdersFeatureDependencies
    let shifts: ShiftsFeatureDependencies
    let newsNotifications: NewsNotificationsFeatureDependencies
    let sharedProfile: SharedProfileFeatureDependencies
    let users: UsersFeatureDependencies
    let myOrderFreshness: MyOrderFreshnessFeatureDependencies
    let bylaws: BylawsFeatureDependencies
}

@Observable
final class AccessRootViewModel {
    @ObservationIgnored let sessionViewModel: SessionViewModel
    @ObservationIgnored let feedbackCenter: GlobalFeedbackCenter
    @ObservationIgnored let productsViewModel: ProductsRouteViewModel
    @ObservationIgnored let shiftsViewModel: ShiftsFeatureViewModel
    @ObservationIgnored let newsNotificationsViewModel: NewsNotificationsFeatureViewModel
    @ObservationIgnored let sharedProfileViewModel: SharedProfileFeatureViewModel
    @ObservationIgnored let usersViewModel: UsersFeatureViewModel
    @ObservationIgnored let myOrderViewModel: MyOrderRouteViewModel
    @ObservationIgnored let receivedOrdersViewModel: ReceivedOrdersRouteViewModel
    @ObservationIgnored let myOrderFreshnessViewModel: MyOrderFreshnessViewModel
    @ObservationIgnored let bylawsViewModel: BylawsFeatureViewModel
    @ObservationIgnored private let startupVersionGateUseCase: ResolveStartupVersionGateUseCase
    @ObservationIgnored private let shouldSkipSplashProvider: () -> Bool
    @ObservationIgnored private let installedVersionProvider: () -> String

    var shellState = AuthShellState()
    var splashScale: CGFloat = SplashAnimationContract.initialScale
    var splashRotation: Double = SplashAnimationContract.initialRotation
    var splashOpacity: Double = SplashAnimationContract.initialOpacity
    var didStartSplashAnimation = false
    var splashDelayCompleted = false
    var startupGateState: StartupGateUIState = .checking
    var didEvaluateStartupGate = false
    var areRegisterPasswordsVisible = false
    var showsRecoverSuccessDialog = false
    var isHomeDrawerOpen = false
    var homeDrawerDragOffset: CGFloat = 0
    var isAdminToolsExpanded = false
    var homeDestination: HomeDestination = .dashboard {
        didSet {
            handleHomeDestinationChange(from: oldValue, to: homeDestination)
        }
    }
    var myOrderCartUnits = 0
    var myOrderCartOpenRequests = 0
    var myOrderReadOnlyMode = false
    var isImpersonationExpanded = false
    var nowOverrideMillis: Int64?

    var shouldSkipSplash: Bool {
        shouldSkipSplashProvider()
    }

    var isHomeRoute: Bool {
        shellState.currentRoute == .home
    }

    var installedVersion: String {
        installedVersionProvider()
    }

    init(
        sessionViewModel: SessionViewModel,
        feedbackCenter: GlobalFeedbackCenter? = nil,
        productsFeatureDependencies: ProductsFeatureDependencies = .preview(),
        ordersFeatureDependencies: OrdersFeatureDependencies = .preview(),
        shiftsFeatureDependencies: ShiftsFeatureDependencies = .preview(),
        newsNotificationsFeatureDependencies: NewsNotificationsFeatureDependencies = .preview(),
        sharedProfileFeatureDependencies: SharedProfileFeatureDependencies = .preview(),
        usersFeatureDependencies: UsersFeatureDependencies = .preview(),
        myOrderFreshnessFeatureDependencies: MyOrderFreshnessFeatureDependencies = .preview(),
        bylawsFeatureDependencies: BylawsFeatureDependencies = .preview(),
        startupVersionGateUseCase: ResolveStartupVersionGateUseCase,
        shouldSkipSplashProvider: @escaping () -> Bool = {
            ProcessInfo.processInfo.arguments.contains("-skipSplash")
        },
        installedVersionProvider: @escaping () -> String = {
            resolveInstalledAppVersion()
        },
        initialNowOverrideMillis: Int64? = nil
    ) {
        self.sessionViewModel = sessionViewModel
        let resolvedFeedbackCenter = feedbackCenter ?? sessionViewModel.feedbackCenter
        self.feedbackCenter = resolvedFeedbackCenter
        let featureViewModels = Self.makeFeatureViewModels(
            sessionViewModel: sessionViewModel,
            feedbackCenter: resolvedFeedbackCenter,
            dependencies: RootFeatureDependencies(
                products: productsFeatureDependencies,
                orders: ordersFeatureDependencies,
                shifts: shiftsFeatureDependencies,
                newsNotifications: newsNotificationsFeatureDependencies,
                sharedProfile: sharedProfileFeatureDependencies,
                users: usersFeatureDependencies,
                myOrderFreshness: myOrderFreshnessFeatureDependencies,
                bylaws: bylawsFeatureDependencies
            )
        )
        self.productsViewModel = featureViewModels.productsViewModel
        self.shiftsViewModel = featureViewModels.shiftsViewModel
        self.newsNotificationsViewModel = featureViewModels.newsNotificationsViewModel
        self.sharedProfileViewModel = featureViewModels.sharedProfileViewModel
        self.usersViewModel = featureViewModels.usersViewModel
        self.myOrderViewModel = featureViewModels.myOrderViewModel
        self.receivedOrdersViewModel = featureViewModels.receivedOrdersViewModel
        self.myOrderFreshnessViewModel = featureViewModels.myOrderFreshnessViewModel
        self.bylawsViewModel = featureViewModels.bylawsViewModel
        self.startupVersionGateUseCase = startupVersionGateUseCase
        self.shouldSkipSplashProvider = shouldSkipSplashProvider
        self.installedVersionProvider = installedVersionProvider
        self.nowOverrideMillis = initialNowOverrideMillis
    }

}

private extension AccessRootViewModel {
    static func makeFeatureViewModels(
        sessionViewModel: SessionViewModel,
        feedbackCenter: GlobalFeedbackCenter,
        dependencies: RootFeatureDependencies
    ) -> RootFeatureViewModels {
        RootFeatureViewModels(
            productsViewModel: makeProductsViewModel(
                sessionViewModel: sessionViewModel,
                feedbackCenter: feedbackCenter,
                dependencies: dependencies.products
            ),
            shiftsViewModel: makeShiftsViewModel(
                sessionViewModel: sessionViewModel,
                feedbackCenter: feedbackCenter,
                dependencies: dependencies.shifts
            ),
            newsNotificationsViewModel: makeNewsNotificationsViewModel(
                sessionViewModel: sessionViewModel,
                feedbackCenter: feedbackCenter,
                dependencies: dependencies.newsNotifications
            ),
            sharedProfileViewModel: makeSharedProfileViewModel(
                sessionViewModel: sessionViewModel,
                feedbackCenter: feedbackCenter,
                dependencies: dependencies.sharedProfile
            ),
            usersViewModel: makeUsersViewModel(
                sessionViewModel: sessionViewModel,
                feedbackCenter: feedbackCenter,
                dependencies: dependencies.users
            ),
            myOrderViewModel: makeMyOrderViewModel(
                sessionViewModel: sessionViewModel,
                dependencies: dependencies.orders
            ),
            receivedOrdersViewModel: makeReceivedOrdersViewModel(
                sessionViewModel: sessionViewModel,
                dependencies: dependencies.orders
            ),
            myOrderFreshnessViewModel: MyOrderFreshnessViewModel(
                dependencies: dependencies.myOrderFreshness
            ),
            bylawsViewModel: BylawsFeatureViewModel(
                feedbackCenter: feedbackCenter,
                dependencies: dependencies.bylaws
            )
        )
    }

    static func makeProductsViewModel(
        sessionViewModel: SessionViewModel,
        feedbackCenter: GlobalFeedbackCenter,
        dependencies: ProductsFeatureDependencies
    ) -> ProductsRouteViewModel {
        ProductsRouteViewModel(
            sessionViewModel: sessionViewModel,
            feedbackCenter: feedbackCenter,
            productRepository: dependencies.productRepository,
            memberRepository: dependencies.memberRepository,
            seasonalCommitmentRepository: dependencies.seasonalCommitmentRepository,
            imagePipelineManager: dependencies.imagePipelineManager,
            nowMillisProvider: dependencies.nowMillisProvider
        )
    }

    static func makeShiftsViewModel(
        sessionViewModel: SessionViewModel,
        feedbackCenter: GlobalFeedbackCenter,
        dependencies: ShiftsFeatureDependencies
    ) -> ShiftsFeatureViewModel {
        ShiftsFeatureViewModel(
            sessionViewModel: sessionViewModel,
            feedbackCenter: feedbackCenter,
            shiftRepository: dependencies.shiftRepository,
            shiftSwapRequestRepository: dependencies.shiftSwapRequestRepository,
            shiftPlanningRequestRepository: dependencies.shiftPlanningRequestRepository,
            deliveryCalendarRepository: dependencies.deliveryCalendarRepository,
            notificationRepository: dependencies.notificationRepository,
            nowMillisProvider: dependencies.nowMillisProvider
        )
    }

    static func makeNewsNotificationsViewModel(
        sessionViewModel: SessionViewModel,
        feedbackCenter: GlobalFeedbackCenter,
        dependencies: NewsNotificationsFeatureDependencies
    ) -> NewsNotificationsFeatureViewModel {
        NewsNotificationsFeatureViewModel(
            sessionViewModel: sessionViewModel,
            feedbackCenter: feedbackCenter,
            newsRepository: dependencies.newsRepository,
            notificationRepository: dependencies.notificationRepository,
            pushNotificationPermissionProvider: dependencies.pushNotificationPermissionProvider,
            imagePipelineManager: dependencies.imagePipelineManager,
            nowMillisProvider: dependencies.nowMillisProvider
        )
    }

    static func makeSharedProfileViewModel(
        sessionViewModel: SessionViewModel,
        feedbackCenter: GlobalFeedbackCenter,
        dependencies: SharedProfileFeatureDependencies
    ) -> SharedProfileFeatureViewModel {
        SharedProfileFeatureViewModel(
            sessionViewModel: sessionViewModel,
            feedbackCenter: feedbackCenter,
            sharedProfileRepository: dependencies.sharedProfileRepository,
            imagePipelineManager: dependencies.imagePipelineManager,
            nowMillisProvider: dependencies.nowMillisProvider
        )
    }

    static func makeUsersViewModel(
        sessionViewModel: SessionViewModel,
        feedbackCenter: GlobalFeedbackCenter,
        dependencies: UsersFeatureDependencies
    ) -> UsersFeatureViewModel {
        UsersFeatureViewModel(
            sessionViewModel: sessionViewModel,
            feedbackCenter: feedbackCenter,
            memberRepository: dependencies.memberRepository,
            upsertMemberByAdmin: dependencies.upsertMemberByAdmin
        )
    }

    static func makeMyOrderViewModel(
        sessionViewModel: SessionViewModel,
        dependencies: OrdersFeatureDependencies
    ) -> MyOrderRouteViewModel {
        MyOrderRouteViewModel(
            sessionViewModel: sessionViewModel,
            ordersRepository: dependencies.ordersRepository,
            cartStore: dependencies.cartStore,
            nowMillisProvider: dependencies.nowMillisProvider
        )
    }

    static func makeReceivedOrdersViewModel(
        sessionViewModel: SessionViewModel,
        dependencies: OrdersFeatureDependencies
    ) -> ReceivedOrdersRouteViewModel {
        ReceivedOrdersRouteViewModel(
            sessionViewModel: sessionViewModel,
            ordersRepository: dependencies.ordersRepository,
            nowMillisProvider: dependencies.nowMillisProvider
        )
    }
}

extension AccessRootViewModel {
    func dispatchShell(_ action: AuthShellAction) {
        shellState = reduceAuthShell(state: shellState, action: action)
    }

    func handleSplashIfNeeded() async {
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

    func refreshSessionAndEvaluateStartupGate() async {
        sessionViewModel.refreshSession(trigger: .startup)
        await evaluateStartupGateIfNeeded()
    }

    func evaluateStartupGateIfNeeded() async {
        guard !didEvaluateStartupGate else { return }
        didEvaluateStartupGate = true

        if shouldSkipSplash {
            startupGateState = .optionalDismissed
            return
        }

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

    func resolveStartupGateDecision(installedVersion: String) async -> StartupVersionGateDecision {
        await withTaskGroup(of: StartupVersionGateDecision.self) { group in
            group.addTask { [startupVersionGateUseCase] in
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

    func continueFromSplashIfAllowed() {
        guard shellState.currentRoute == .splash else { return }
        guard splashDelayCompleted else { return }
        guard startupGateState.allowsContinuation else { return }
        dispatchShell(.splashCompleted(isAuthenticated: sessionViewModel.mode.isAuthenticatedSession))
    }

    func startSplashAnimationIfNeeded() {
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

    func resetSplashAnimationState() {
        didStartSplashAnimation = false
        splashDelayCompleted = false
        splashScale = SplashAnimationContract.initialScale
        splashRotation = SplashAnimationContract.initialRotation
        splashOpacity = SplashAnimationContract.initialOpacity
    }

    func handleSessionModeChange(_ mode: SessionMode) {
        handleSessionModeChange(from: sessionViewModel.mode, to: mode)
    }

    func handleSessionModeChange(from previousMode: SessionMode, to mode: SessionMode) {
        myOrderFreshnessViewModel.handleSessionModeChange(from: previousMode, to: mode)
        productsViewModel.handleSessionModeChange(mode)
        shiftsViewModel.handleSessionModeChange(mode)
        newsNotificationsViewModel.handleSessionModeChange(mode)
        sharedProfileViewModel.handleSessionModeChange(mode)
        usersViewModel.handleSessionModeChange(mode)
        guard shellState.currentRoute != .splash else { return }

        switch mode {
        case .authorized, .unauthorized:
            dispatchShell(.sessionAuthenticated)
        case .signedOut:
            dispatchShell(.signedOut)
        }
    }

    func handleNowOverrideChange() {
        productsViewModel.handleNowOverrideChange()
        shiftsViewModel.handleNowOverrideChange()
    }

    func setNowOverrideMillis(_ nowMillis: Int64?) {
        DevelopmentTimeMachine.shared.setOverrideNowMillis(nowMillis)
        nowOverrideMillis = nowMillis
        handleNowOverrideChange()
    }

    func shiftNowByDays(_ days: Int) {
        let baseMillis = nowOverrideMillis ?? Int64(Date().timeIntervalSince1970 * 1_000)
        let shiftedMillis = baseMillis + Int64(days) * 24 * 60 * 60 * 1_000
        setNowOverrideMillis(shiftedMillis)
    }

    func handleScenePhaseChange(_ newPhase: ScenePhase) {
        switch newPhase {
        case .active:
            sessionViewModel.refreshSession(trigger: .foreground)
        case .inactive, .background:
            myOrderViewModel.persistCurrentCartSnapshotIfNeeded()
        default:
            break
        }
    }

    func handleShellRouteChange(from previousRoute: AuthShellRoute, to newRoute: AuthShellRoute) {
        if newRoute != .splash {
            resetSplashAnimationState()
        }
        handleAuthRouteExit(from: previousRoute, to: newRoute)
    }

    func handleFeedbackMessageChange(_ feedbackKey: String?) {
        guard feedbackKey == AccessL10nKey.authInfoPasswordResetSent else { return }
        feedbackCenter.clear()
        showsRecoverSuccessDialog = true
    }

    func handleSessionExpiredDialogAction() {
        sessionViewModel.dismissSessionExpiredDialog()
        sessionViewModel.resetSignInDraft()
        dispatchShell(.reauthenticate)
    }

    func handleUnauthorizedDialogSignOut() {
        homeDestination = .dashboard
        sessionViewModel.signOut()
        dispatchShell(.signedOut)
    }

    func dismissOptionalStartupUpdate() {
        startupGateState = .optionalDismissed
    }

    func handleAuthRouteExit(from previousRoute: AuthShellRoute, to newRoute: AuthShellRoute) {
        guard previousRoute != newRoute else { return }
        if previousRoute == .home || newRoute != .home {
            isHomeDrawerOpen = false
            homeDrawerDragOffset = 0
        }

        switch previousRoute {
        case .login where newRoute != .login:
            sessionViewModel.resetSignInDraft()
            feedbackCenter.clear()
        case .register where newRoute != .register:
            sessionViewModel.resetSignUpDraft()
            feedbackCenter.clear()
            areRegisterPasswordsVisible = false
        case .recoverPassword where newRoute != .recoverPassword:
            sessionViewModel.resetRecoverDraft()
            feedbackCenter.clear()
            showsRecoverSuccessDialog = false
        default:
            break
        }
    }

    func handleRecoverSuccessDialogDismiss() {
        showsRecoverSuccessDialog = false
        sessionViewModel.resetRecoverDraft()
        dispatchShell(.signedOut)
    }

    func handleHomeDestinationChange(from previousDestination: HomeDestination, to destination: HomeDestination) {
        guard previousDestination != destination else { return }
        if previousDestination == .notifications {
            Task { await newsNotificationsViewModel.markVisibleNotificationsReadOnExit() }
        }
        if destination == .notifications {
            Task { await newsNotificationsViewModel.prepareNotificationsRoute() }
        }
    }
}
