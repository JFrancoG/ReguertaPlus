import SwiftUI

struct ContentView: View {
    var body: some View {
        MainView()
    }
}

protocol AccessRootRoutingView: View {
    var appEnvironment: ReguertaAppEnvironment { get }
    var tokens: ReguertaDesignTokens { get }
    var openURL: OpenURLAction { get }
}

extension AccessRootRoutingView {
    func rootBinding<Value>(_ keyPath: ReferenceWritableKeyPath<AccessRootViewModel, Value>) -> Binding<Value> {
        Binding(
            get: { rootViewModel[keyPath: keyPath] },
            set: { rootViewModel[keyPath: keyPath] = $0 }
        )
    }

    var rootViewModel: AccessRootViewModel {
        appEnvironment.accessRootViewModel
    }

    var viewModel: SessionViewModel {
        appEnvironment.sessionViewModel
    }

    var feedbackCenter: GlobalFeedbackCenter {
        appEnvironment.feedbackCenter
    }

    var shellState: AuthShellState {
        get { rootViewModel.shellState }
        nonmutating set { rootViewModel.shellState = newValue }
    }

    var splashScale: CGFloat {
        get { rootViewModel.splashScale }
        nonmutating set { rootViewModel.splashScale = newValue }
    }

    var splashRotation: Double {
        get { rootViewModel.splashRotation }
        nonmutating set { rootViewModel.splashRotation = newValue }
    }

    var splashOpacity: Double {
        get { rootViewModel.splashOpacity }
        nonmutating set { rootViewModel.splashOpacity = newValue }
    }

    var didStartSplashAnimation: Bool {
        get { rootViewModel.didStartSplashAnimation }
        nonmutating set { rootViewModel.didStartSplashAnimation = newValue }
    }

    var splashDelayCompleted: Bool {
        get { rootViewModel.splashDelayCompleted }
        nonmutating set { rootViewModel.splashDelayCompleted = newValue }
    }

    var startupGateState: StartupGateUIState {
        get { rootViewModel.startupGateState }
        nonmutating set { rootViewModel.startupGateState = newValue }
    }

    var didEvaluateStartupGate: Bool {
        get { rootViewModel.didEvaluateStartupGate }
        nonmutating set { rootViewModel.didEvaluateStartupGate = newValue }
    }

    var areRegisterPasswordsVisible: Bool {
        get { rootViewModel.areRegisterPasswordsVisible }
        nonmutating set { rootViewModel.areRegisterPasswordsVisible = newValue }
    }

    var showsRecoverSuccessDialog: Bool {
        get { rootViewModel.showsRecoverSuccessDialog }
        nonmutating set { rootViewModel.showsRecoverSuccessDialog = newValue }
    }

    var isHomeDrawerOpen: Bool {
        get { rootViewModel.isHomeDrawerOpen }
        nonmutating set { rootViewModel.isHomeDrawerOpen = newValue }
    }

    var homeDrawerDragOffset: CGFloat {
        get { rootViewModel.homeDrawerDragOffset }
        nonmutating set { rootViewModel.homeDrawerDragOffset = newValue }
    }

    var isAdminToolsExpanded: Bool {
        get { rootViewModel.isAdminToolsExpanded }
        nonmutating set { rootViewModel.isAdminToolsExpanded = newValue }
    }

    var homeDestination: HomeDestination {
        get { rootViewModel.homeDestination }
        nonmutating set { rootViewModel.homeDestination = newValue }
    }

    var myOrderCartUnits: Int {
        get { rootViewModel.myOrderCartUnits }
        nonmutating set { rootViewModel.myOrderCartUnits = newValue }
    }

    var myOrderCartOpenRequests: Int {
        get { rootViewModel.myOrderCartOpenRequests }
        nonmutating set { rootViewModel.myOrderCartOpenRequests = newValue }
    }

    var myOrderReadOnlyMode: Bool {
        get { rootViewModel.myOrderReadOnlyMode }
        nonmutating set { rootViewModel.myOrderReadOnlyMode = newValue }
    }

    var isImpersonationExpanded: Bool {
        get { rootViewModel.isImpersonationExpanded }
        nonmutating set { rootViewModel.isImpersonationExpanded = newValue }
    }

    var nowOverrideMillis: Int64? {
        get { rootViewModel.nowOverrideMillis }
        nonmutating set { rootViewModel.nowOverrideMillis = newValue }
    }

    var shouldSkipSplash: Bool {
        rootViewModel.shouldSkipSplash
    }

    var isHomeRoute: Bool {
        rootViewModel.isHomeRoute
    }

    var installedVersion: String {
        rootViewModel.installedVersion
    }
}

struct AccessRootView: View {
    var body: some View {
        MainView()
    }
}

struct MainView: AccessRootRoutingView {
    @Environment(\.reguertaAppEnvironment) var appEnvironment
    @Environment(\.openURL) var openURL
    @Environment(\.reguertaTokens) var tokens
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        NavigationStack {
            RootRouteView()
                .padding(isHomeRoute ? 0 : tokens.spacing.lg)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                .background(tokens.colors.surfacePrimary.ignoresSafeArea())
                .overlay {
                    DeviceScaleCaptureView()
                }
                .toolbar(.hidden, for: .navigationBar)
        }
        .overlay {
            RootOverlayView()
        }
        .task(id: shellState.currentRoute) {
            await rootViewModel.handleSplashIfNeeded()
        }
        .task {
            await rootViewModel.refreshSessionAndEvaluateStartupGate()
        }
        .onChange(of: viewModel.mode) { previousMode, mode in
            rootViewModel.handleSessionModeChange(from: previousMode, to: mode)
        }
        .onChange(of: rootViewModel.nowOverrideMillis) { _, _ in
            rootViewModel.handleNowOverrideChange()
        }
        .onChange(of: scenePhase) { _, newPhase in
            rootViewModel.handleScenePhaseChange(newPhase)
        }
        .onChange(of: startupGateState) { _, _ in
            rootViewModel.continueFromSplashIfAllowed()
        }
        .onChange(of: splashDelayCompleted) { _, _ in
            rootViewModel.continueFromSplashIfAllowed()
        }
        .onChange(of: shellState.currentRoute) { previousRoute, route in
            rootViewModel.handleShellRouteChange(from: previousRoute, to: route)
        }
        .onChange(of: feedbackCenter.messageKey) { _, feedbackKey in
            rootViewModel.handleFeedbackMessageChange(feedbackKey)
        }
    }
}

struct RootRouteView: AccessRootRoutingView {
    @Environment(\.reguertaAppEnvironment) var appEnvironment
    @Environment(\.openURL) var openURL
    @Environment(\.reguertaTokens) var tokens

    var body: some View {
        if isHomeRoute {
            HomeShellView()
        } else {
            AuthShellView()
        }
    }
}

struct AuthShellView: AccessRootRoutingView {
    @Environment(\.reguertaAppEnvironment) var appEnvironment
    @Environment(\.openURL) var openURL
    @Environment(\.reguertaTokens) var tokens

    var body: some View {
        if shellState.currentRoute == .splash {
            splashRoute
        } else {
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: tokens.spacing.lg) {
                    currentAuthRoute
                    feedbackMessageRoute
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .containerRelativeFrame(.vertical, alignment: .top)
                .padding(.bottom, tokens.spacing.md)
            }
            .scrollDismissesKeyboard(.interactively)
        }
    }
}

struct HomeShellView: AccessRootRoutingView {
    @Environment(\.reguertaAppEnvironment) var appEnvironment
    @Environment(\.openURL) var openURL
    @Environment(\.reguertaTokens) var tokens

    var body: some View {
        homeRoute
    }
}

struct RootOverlayView: AccessRootRoutingView {
    @Environment(\.reguertaAppEnvironment) var appEnvironment
    @Environment(\.openURL) var openURL
    @Environment(\.reguertaTokens) var tokens

    var body: some View {
        overlayDialogs
    }
}

#Preview {
    ContentView()
        .environment(\.reguertaAppEnvironment, .preview())
}
