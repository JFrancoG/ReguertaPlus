import SwiftUI

struct MainView: View {
    @Environment(\.reguertaAppEnvironment) private var appEnvironment
    @Environment(\.openURL) private var openURL
    @Environment(\.reguertaTokens) private var tokens
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityVoiceOverEnabled) private var isVoiceOverEnabled

    var body: some View {
        let rootViewModel = appEnvironment.accessRootViewModel
        let sessionViewModel = appEnvironment.sessionViewModel
        let feedbackCenter = appEnvironment.feedbackCenter

        NavigationStack {
            RootRouteView(
                rootViewModel: rootViewModel,
                sessionViewModel: sessionViewModel,
                tokens: tokens,
                openURL: openURL,
                loadNewsImageData: appEnvironment.loadNewsImageData
            )
            .padding(rootViewModel.isHomeRoute ? 0 : tokens.spacing.lg)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background(tokens.colors.surfacePrimary.ignoresSafeArea())
            .overlay {
                DeviceScaleCaptureView()
            }
            .toolbar(.hidden, for: .navigationBar)
        }
        .overlay(alignment: .bottom) {
            GlobalFeedbackRouteView(
                tokens: tokens,
                isVoiceOverEnabled: isVoiceOverEnabled,
                messageKey: rootViewModel.shellState.currentRoute == .splash ? nil : feedbackCenter.messageKey,
                dismissTitle: LocalizedStringKey(AccessL10nKey.dismissMessage)
            ) { feedbackKey in
                if feedbackCenter.messageKey == feedbackKey {
                    feedbackCenter.clear()
                }
            }
        }
        .animation(.easeInOut(duration: 0.2), value: feedbackCenter.messageKey)
        .overlay {
            RootOverlayView(
                rootViewModel: rootViewModel,
                sessionViewModel: sessionViewModel
            )
        }
        .task(id: rootViewModel.shellState.currentRoute) {
            await rootViewModel.handleSplashIfNeeded()
        }
        .task {
            rootViewModel.refreshSessionAndEvaluateStartupGate()
        }
        .onChange(of: sessionViewModel.mode) { previousMode, mode in
            rootViewModel.handleSessionModeChange(from: previousMode, to: mode)
        }
        .onChange(of: rootViewModel.nowOverrideMillis) { _, _ in
            rootViewModel.handleNowOverrideChange()
        }
        .onChange(of: scenePhase) { _, newPhase in
            rootViewModel.handleScenePhaseChange(newPhase)
        }
        .onChange(of: rootViewModel.startupGateState) { _, _ in
            rootViewModel.continueFromSplashIfAllowed()
        }
        .onChange(of: rootViewModel.splashDelayCompleted) { _, _ in
            rootViewModel.continueFromSplashIfAllowed()
        }
        .onChange(of: rootViewModel.shellState.currentRoute) { previousRoute, route in
            rootViewModel.handleShellRouteChange(from: previousRoute, to: route)
        }
        .onChange(of: feedbackCenter.messageKey) { _, feedbackKey in
            rootViewModel.handleFeedbackMessageChange(feedbackKey)
        }
    }
}

#Preview("Main shell", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    MainView()
        .reguertaAppEnvironment(startupGatePreviewEnvironment(.unavailable))
}

@MainActor
func startupGatePreviewEnvironment(_ state: StartupGateUIState) -> ReguertaAppEnvironment {
    let environment = ReguertaAppEnvironment.preview()
    environment.accessRootViewModel.didEvaluateStartupGate = true
    environment.accessRootViewModel.startupGateState = state
    return environment
}

@MainActor
func routePreviewEnvironment(_ route: AuthShellRoute) -> ReguertaAppEnvironment {
    let environment = startupGatePreviewEnvironment(.ready)
    environment.accessRootViewModel.shellState = AuthShellState(backStack: [route])
    return environment
}

@MainActor
func rootOverlayPreviewEnvironment() -> ReguertaAppEnvironment {
    let environment = routePreviewEnvironment(.welcome)
    environment.accessRootViewModel.showsRecoverSuccessDialog = true
    return environment
}
