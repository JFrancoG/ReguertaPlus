import FirebaseFirestore
import SwiftUI

struct ContentView: View {
    @Environment(\.openURL) var openURL
    @Environment(\.reguertaTokens) var tokens
    @Environment(\.scenePhase) var scenePhase
    @State var viewModel: SessionViewModel
    @State var shellState = AuthShellState()
    @State var splashScale: CGFloat = SplashAnimationContract.initialScale
    @State var splashRotation: Double = SplashAnimationContract.initialRotation
    @State var splashOpacity: Double = SplashAnimationContract.initialOpacity
    @State var didStartSplashAnimation = false
    @State var splashDelayCompleted = false
    @State var startupGateState: StartupGateUIState = .checking
    @State var didEvaluateStartupGate = false
    @State var areRegisterPasswordsVisible = false
    @State var showsRecoverSuccessDialog = false
    @State var isHomeDrawerOpen = false
    @State var homeDrawerDragOffset: CGFloat = 0
    @State var isAdminToolsExpanded = false
    @State var homeDestination: HomeDestination = .dashboard
    @State var pendingNewsDeletionId: String?
    @State var pendingProducerCatalogVisibility: Bool?
    @State var selectedShiftSegment: ShiftBoardSegment = .delivery
    @State var isDeliveryCalendarEditorPresented = false
    @State var isDeliveryCalendarWeekPickerPresented = false
    @State var selectedDeliveryCalendarWeekKey: String?
    @State var isImpersonationExpanded = false
    @State var pendingShiftPlanningType: ShiftPlanningRequestType?

    let startupVersionGateUseCase = ResolveStartupVersionGateUseCase(
        repository: FirestoreStartupVersionPolicyRepository()
    )

    init() {
        let db = Firestore.firestore()
        let deviceRepository = FirestoreDeviceRegistrationRepository(db: db)
        let reviewerEnvironmentRouter = FirestoreReviewerEnvironmentRouter(db: db)
        #if DEBUG
        let developImpersonationEnabled = true
        #else
        let developImpersonationEnabled = false
        #endif
        _viewModel = State(
            initialValue: SessionViewModel(
                authorizedDeviceRegistrar: FirebaseAuthorizedDeviceRegistrar(repository: deviceRepository),
                reviewerEnvironmentRouter: reviewerEnvironmentRouter,
                developImpersonationEnabled: developImpersonationEnabled,
                nowMillisProvider: { DevelopmentTimeMachine.shared.nowMillis() },
                initialNowOverrideMillis: DevelopmentTimeMachine.shared.overrideNowMillis
            )
        )
    }

    var shouldSkipSplash: Bool {
        ProcessInfo.processInfo.arguments.contains("-skipSplash")
    }

    var isHomeRoute: Bool {
        shellState.currentRoute == .home
    }

    var installedVersion: String {
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
}

#Preview {
    ContentView()
}
