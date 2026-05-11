import SwiftUI

extension AccessRootRoutingView {
    func dispatchShell(_ action: AuthShellAction) {
        rootViewModel.dispatchShell(action)
    }

    func handleSplashIfNeeded() async {
        await rootViewModel.handleSplashIfNeeded()
    }

    func evaluateStartupGateIfNeeded() async {
        await rootViewModel.evaluateStartupGateIfNeeded()
    }

    func resolveStartupGateDecision(installedVersion: String) async -> StartupVersionGateDecision {
        await rootViewModel.resolveStartupGateDecision(installedVersion: installedVersion)
    }

    func continueFromSplashIfAllowed() {
        rootViewModel.continueFromSplashIfAllowed()
    }

    func startSplashAnimationIfNeeded() {
        rootViewModel.startSplashAnimationIfNeeded()
    }

    func resetSplashAnimationState() {
        rootViewModel.resetSplashAnimationState()
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
