import Observation
import SwiftUI

@Observable
final class AccessRootViewModel {
    @ObservationIgnored let sessionViewModel: SessionViewModel
    @ObservationIgnored let productsViewModel: ProductsRouteViewModel
    @ObservationIgnored let shiftsViewModel: ShiftsFeatureViewModel
    @ObservationIgnored let newsNotificationsViewModel: NewsNotificationsFeatureViewModel
    @ObservationIgnored let sharedProfileViewModel: SharedProfileFeatureViewModel
    @ObservationIgnored let myOrderViewModel: MyOrderRouteViewModel
    @ObservationIgnored let receivedOrdersViewModel: ReceivedOrdersRouteViewModel
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
    var homeDestination: HomeDestination = .dashboard
    var myOrderCartUnits = 0
    var myOrderCartOpenRequests = 0
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
        productsFeatureDependencies: ProductsFeatureDependencies = .preview(),
        ordersFeatureDependencies: OrdersFeatureDependencies = .preview(),
        shiftsFeatureDependencies: ShiftsFeatureDependencies = .preview(),
        newsNotificationsFeatureDependencies: NewsNotificationsFeatureDependencies = .preview(),
        sharedProfileFeatureDependencies: SharedProfileFeatureDependencies = .preview(),
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
        self.productsViewModel = ProductsRouteViewModel(
            sessionViewModel: sessionViewModel,
            productRepository: productsFeatureDependencies.productRepository,
            memberRepository: productsFeatureDependencies.memberRepository,
            seasonalCommitmentRepository: productsFeatureDependencies.seasonalCommitmentRepository,
            imagePipelineManager: productsFeatureDependencies.imagePipelineManager,
            nowMillisProvider: productsFeatureDependencies.nowMillisProvider
        )
        self.shiftsViewModel = ShiftsFeatureViewModel(
            sessionViewModel: sessionViewModel,
            shiftRepository: shiftsFeatureDependencies.shiftRepository,
            shiftSwapRequestRepository: shiftsFeatureDependencies.shiftSwapRequestRepository,
            shiftPlanningRequestRepository: shiftsFeatureDependencies.shiftPlanningRequestRepository,
            deliveryCalendarRepository: shiftsFeatureDependencies.deliveryCalendarRepository,
            notificationRepository: shiftsFeatureDependencies.notificationRepository,
            nowMillisProvider: shiftsFeatureDependencies.nowMillisProvider
        )
        self.newsNotificationsViewModel = NewsNotificationsFeatureViewModel(
            sessionViewModel: sessionViewModel,
            newsRepository: newsNotificationsFeatureDependencies.newsRepository,
            notificationRepository: newsNotificationsFeatureDependencies.notificationRepository,
            imagePipelineManager: newsNotificationsFeatureDependencies.imagePipelineManager,
            nowMillisProvider: newsNotificationsFeatureDependencies.nowMillisProvider
        )
        self.sharedProfileViewModel = SharedProfileFeatureViewModel(
            sessionViewModel: sessionViewModel,
            sharedProfileRepository: sharedProfileFeatureDependencies.sharedProfileRepository,
            imagePipelineManager: sharedProfileFeatureDependencies.imagePipelineManager,
            nowMillisProvider: sharedProfileFeatureDependencies.nowMillisProvider
        )
        self.myOrderViewModel = MyOrderRouteViewModel(
            sessionViewModel: sessionViewModel,
            ordersRepository: ordersFeatureDependencies.ordersRepository,
            cartStore: ordersFeatureDependencies.cartStore,
            nowMillisProvider: ordersFeatureDependencies.nowMillisProvider
        )
        self.receivedOrdersViewModel = ReceivedOrdersRouteViewModel(
            sessionViewModel: sessionViewModel,
            ordersRepository: ordersFeatureDependencies.ordersRepository,
            nowMillisProvider: ordersFeatureDependencies.nowMillisProvider
        )
        self.startupVersionGateUseCase = startupVersionGateUseCase
        self.shouldSkipSplashProvider = shouldSkipSplashProvider
        self.installedVersionProvider = installedVersionProvider
        self.nowOverrideMillis = initialNowOverrideMillis
    }

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
        productsViewModel.handleSessionModeChange(mode)
        shiftsViewModel.handleSessionModeChange(mode)
        newsNotificationsViewModel.handleSessionModeChange(mode)
        sharedProfileViewModel.handleSessionModeChange(mode)
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
        sessionViewModel.clearFeedbackMessage()
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
            sessionViewModel.clearFeedbackMessage()
        case .register where newRoute != .register:
            sessionViewModel.resetSignUpDraft()
            sessionViewModel.clearFeedbackMessage()
            areRegisterPasswordsVisible = false
        case .recoverPassword where newRoute != .recoverPassword:
            sessionViewModel.resetRecoverDraft()
            sessionViewModel.clearFeedbackMessage()
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
}
