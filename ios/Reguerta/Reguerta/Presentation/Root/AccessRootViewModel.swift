import SwiftUI

private struct RootFeatureViewModels {
    let productsViewModel: ProductsRouteViewModel
    let shiftsViewModel: ShiftsFeatureViewModel
    let newsNotificationsViewModel: NewsNotificationsFeatureViewModel
    let sharedProfileViewModel: SharedProfileFeatureViewModel
    let usersViewModel: UsersFeatureViewModel
    let myOrderViewModel: MyOrderRouteViewModel
    let myOrdersHistoryViewModel: MyOrdersHistoryRouteViewModel
    let receivedOrdersViewModel: ReceivedOrdersRouteViewModel
    let receivedOrdersHistoryViewModel: ReceivedOrdersHistoryRouteViewModel
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

@MainActor
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
    @ObservationIgnored let myOrdersHistoryViewModel: MyOrdersHistoryRouteViewModel
    @ObservationIgnored let receivedOrdersViewModel: ReceivedOrdersRouteViewModel
    @ObservationIgnored let receivedOrdersHistoryViewModel: ReceivedOrdersHistoryRouteViewModel
    @ObservationIgnored let myOrderFreshnessViewModel: MyOrderFreshnessViewModel
    @ObservationIgnored let resolveMyOrderLocalStateUseCase: ResolveMyOrderLocalStateUseCase
    @ObservationIgnored let bylawsViewModel: BylawsFeatureViewModel
    @ObservationIgnored private let developmentTimeMachine: DevelopmentTimeMachine
    @ObservationIgnored let startupVersionGateUseCase: ResolveStartupVersionGateUseCase
    @ObservationIgnored private let shouldSkipSplashProvider: () -> Bool
    @ObservationIgnored private let installedVersionProvider: () -> String
    @ObservationIgnored let splashClock: PresentationDelayClock
    @ObservationIgnored let startupGateTimeout: Duration
    @ObservationIgnored let startupGateSleeper: @Sendable (Duration) async throws -> Void
    @ObservationIgnored var startupGateOperationTask: Task<Void, Never>?
    @ObservationIgnored var startupGateTimeoutTask: Task<Void, Never>?
    @ObservationIgnored var startupGateGeneration: UInt64 = 0
    @ObservationIgnored var myOrderEntryTask: Task<Void, Never>?
    @ObservationIgnored var myOrderEntryGeneration: UInt64 = 0
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
    var sharedProfileTitleOverride: String?
    var myOrdersHistoryTitleOverride: String?
    var receivedOrdersHistoryTitleOverride: String?
    var showsSharedProfileSavedDialog = false
    var showsHomeSignOutDialog = false
    var resolvedHomeOrderStateScope: HomeOrderStateScope?
    var homeOrderLocalState: MyOrderLocalState = .empty
    var nowOverrideMillis: Int64?
    @ObservationIgnored var homeOrderStateGeneration: UInt64 = 0
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
        productsFeatureDependencies: ProductsFeatureDependencies,
        ordersFeatureDependencies: OrdersFeatureDependencies,
        shiftsFeatureDependencies: ShiftsFeatureDependencies,
        newsNotificationsFeatureDependencies: NewsNotificationsFeatureDependencies,
        sharedProfileFeatureDependencies: SharedProfileFeatureDependencies,
        usersFeatureDependencies: UsersFeatureDependencies,
        myOrderFreshnessFeatureDependencies: MyOrderFreshnessFeatureDependencies,
        bylawsFeatureDependencies: BylawsFeatureDependencies,
        developmentTimeMachine: DevelopmentTimeMachine,
        startupVersionGateUseCase: ResolveStartupVersionGateUseCase,
        shouldSkipSplashProvider: @escaping () -> Bool,
        installedVersionProvider: @escaping () -> String = {
            resolveInstalledAppVersion()
        },
        splashClock: PresentationDelayClock = .continuous,
        startupGateTimeout: Duration = .milliseconds(2_500),
        startupGateSleeper: @escaping @Sendable (Duration) async throws -> Void = {
            try await ContinuousClock().sleep(for: $0)
        }
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
        self.myOrdersHistoryViewModel = featureViewModels.myOrdersHistoryViewModel
        self.receivedOrdersViewModel = featureViewModels.receivedOrdersViewModel
        self.receivedOrdersHistoryViewModel = featureViewModels.receivedOrdersHistoryViewModel
        self.myOrderFreshnessViewModel = featureViewModels.myOrderFreshnessViewModel
        self.resolveMyOrderLocalStateUseCase = ordersFeatureDependencies.resolveMyOrderLocalStateUseCase
        self.bylawsViewModel = featureViewModels.bylawsViewModel
        self.developmentTimeMachine = developmentTimeMachine
        self.startupVersionGateUseCase = startupVersionGateUseCase
        self.shouldSkipSplashProvider = shouldSkipSplashProvider
        self.installedVersionProvider = installedVersionProvider
        self.splashClock = splashClock
        self.startupGateTimeout = startupGateTimeout
        self.startupGateSleeper = startupGateSleeper
        self.nowOverrideMillis = developmentTimeMachine.overrideNowMillis
    }
}

private extension AccessRootViewModel {
    static func makeFeatureViewModels(
        sessionViewModel: SessionViewModel,
        feedbackCenter: GlobalFeedbackCenter,
        dependencies: RootFeatureDependencies
    ) -> RootFeatureViewModels {
        let orderingViewModels = makeOrderingViewModels(
            sessionViewModel: sessionViewModel,
            feedbackCenter: feedbackCenter,
            productsDependencies: dependencies.products,
            freshnessDependencies: dependencies.myOrderFreshness
        )

        return RootFeatureViewModels(
            productsViewModel: orderingViewModels.products,
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
            myOrdersHistoryViewModel: makeMyOrdersHistoryViewModel(
                sessionViewModel: sessionViewModel,
                dependencies: dependencies.orders
            ),
            receivedOrdersViewModel: makeReceivedOrdersViewModel(
                sessionViewModel: sessionViewModel,
                dependencies: dependencies.orders
            ),
            receivedOrdersHistoryViewModel: makeReceivedOrdersHistoryViewModel(
                sessionViewModel: sessionViewModel,
                dependencies: dependencies.orders
            ),
            myOrderFreshnessViewModel: orderingViewModels.freshness,
            bylawsViewModel: BylawsFeatureViewModel(
                feedbackCenter: feedbackCenter,
                dependencies: dependencies.bylaws
            )
        )
    }

    static func makeOrderingViewModels(
        sessionViewModel: SessionViewModel,
        feedbackCenter: GlobalFeedbackCenter,
        productsDependencies: ProductsFeatureDependencies,
        freshnessDependencies: MyOrderFreshnessFeatureDependencies
    ) -> (products: ProductsRouteViewModel, freshness: MyOrderFreshnessViewModel) {
        let productsViewModel = makeProductsViewModel(
            sessionViewModel: sessionViewModel,
            feedbackCenter: feedbackCenter,
            dependencies: productsDependencies
        )
        let freshnessViewModel = makeMyOrderFreshnessViewModel(
            productsViewModel: productsViewModel,
            dependencies: freshnessDependencies
        )
        return (productsViewModel, freshnessViewModel)
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
            nowMillisProvider: dependencies.nowMillisProvider,
            environmentProvider: dependencies.environmentProvider
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
            nowMillisProvider: dependencies.nowMillisProvider,
            environmentProvider: dependencies.environmentProvider,
            environmentRoutingSignal: sessionViewModel.environmentRouter.transitionSignal
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

}

extension AccessRootViewModel {
    /// Applies an Auth-shell transition and completes route-exit cleanup in the same MainActor turn.
    ///
    /// Running cleanup immediately after the reducer invalidates route-owned tasks and drafts before a suspended
    /// operation can publish into the destination route; callers must not defer this boundary to a View callback.
    func dispatchShell(_ action: AuthShellAction) {
        let previousRoute = shellState.currentRoute
        shellState = reduceAuthShell(state: shellState, action: action)
        handleShellRouteChange(from: previousRoute, to: shellState.currentRoute)
    }

    func startSplashAnimationIfNeeded() {
        guard shellState.currentRoute == .splash else { return }
        guard !shouldSkipSplash else { return }
        guard !didStartSplashAnimation else { return }
        didStartSplashAnimation = true

        splashScale = SplashAnimationContract.finalScale
        splashRotation = SplashAnimationContract.finalRotation
        splashOpacity = SplashAnimationContract.finalOpacity
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
        let preservesHomeEntry = homeDestination == .dashboard &&
            myOrderEntryTask?.isCancelled == false &&
            myOrderFreshnessViewModel.recognizesAcknowledgedRevisionHandoff(
                from: previousMode,
                to: mode
            )
        if !preservesHomeEntry {
            invalidateHomeMyOrderEntryIntent()
        }
        myOrderViewModel.invalidateCartPersistenceForSessionChange()
        productsViewModel.handleSessionModeChange(mode)
        myOrderFreshnessViewModel.handleSessionModeChange(from: previousMode, to: mode)
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
        developmentTimeMachine.setOverrideNowMillis(nowMillis)
        nowOverrideMillis = nowMillis
        handleNowOverrideChange()
    }

    func shiftNowByDays(_ days: Int) {
        let baseMillis = developmentTimeMachine.nowMillis()
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
        invalidateHomeMyOrderEntryIntent()
        if previousDestination == .dashboard {
            homeOrderStateGeneration &+= 1
        }
        if previousDestination == .notifications {
            Task { await newsNotificationsViewModel.markVisibleNotificationsReadOnExit() }
        }
        if destination != .profile {
            sharedProfileTitleOverride = nil
        }
        if destination != .myOrders {
            myOrdersHistoryTitleOverride = nil
        }
        if destination != .receivedOrdersHistory {
            receivedOrdersHistoryTitleOverride = nil
        }
        if destination == .notifications {
            Task { await newsNotificationsViewModel.prepareNotificationsRoute() }
        }
    }
}
