import SwiftUI

extension ContentView {
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

    func evaluateStartupGateIfNeeded() async {
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

    func resolveStartupGateDecision(installedVersion: String) async -> StartupVersionGateDecision {
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

    func continueFromSplashIfAllowed() {
        guard shellState.currentRoute == .splash else { return }
        guard splashDelayCompleted else { return }
        guard startupGateState.allowsContinuation else { return }
        dispatchShell(.splashCompleted(isAuthenticated: viewModel.mode.isAuthenticatedSession))
    }
    @MainActor
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

    @MainActor
    func resetSplashAnimationState() {
        didStartSplashAnimation = false
        splashDelayCompleted = false
        splashScale = SplashAnimationContract.initialScale
        splashRotation = SplashAnimationContract.initialRotation
        splashOpacity = SplashAnimationContract.initialOpacity
    }
}

enum SplashAnimationContract {
    static let durationSeconds: Double = 1.5
    static let durationNanoseconds: UInt64 = 1_500_000_000
    static let initialScale: CGFloat = 0.2
    static let finalScale: CGFloat = 18.0
    static let initialRotation: Double = 0
    static let finalRotation: Double = 720.0
    static let initialOpacity: Double = 1.0
    static let finalOpacity: Double = 0.0
}

enum StartupGateContract {
    static let fetchTimeoutNanoseconds: UInt64 = 2_500_000_000
}
