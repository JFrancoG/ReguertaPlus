import Foundation

struct RuntimeSessionEnvironmentRouter: SessionEnvironmentRouting {
    var baseEnvironment: SessionEnvironment {
        ReguertaRuntimeEnvironment.baseFirestoreEnvironment
    }

    func applyResolvedEnvironment(_ environment: SessionEnvironment, lease: SessionEnvironmentLease) {
        ReguertaRuntimeEnvironment.applySessionEnvironment(environment, lease: lease)
    }

    func resetToBaseEnvironment(ifOwnedBy lease: SessionEnvironmentLease) {
        ReguertaRuntimeEnvironment.resetToBaseEnvironment(ifOwnedBy: lease)
    }

    func resetToBaseEnvironment() {
        ReguertaRuntimeEnvironment.resetToBaseEnvironment()
    }
}

struct FixedSessionEnvironmentRouter: SessionEnvironmentRouting {
    let baseEnvironment: SessionEnvironment
    private let state: FixedSessionEnvironmentRouterState
    private let onApply: @MainActor @Sendable (SessionEnvironment) -> Void
    private let onReset: @MainActor @Sendable () -> Void

    init(
        baseEnvironment: SessionEnvironment = .develop,
        onApply: @escaping @MainActor @Sendable (SessionEnvironment) -> Void = { _ in },
        onReset: @escaping @MainActor @Sendable () -> Void = {}
    ) {
        self.baseEnvironment = baseEnvironment
        self.state = FixedSessionEnvironmentRouterState()
        self.onApply = onApply
        self.onReset = onReset
    }

    func applyResolvedEnvironment(_ environment: SessionEnvironment, lease: SessionEnvironmentLease) {
        state.activeLease = lease
        onApply(environment)
    }

    func resetToBaseEnvironment(ifOwnedBy lease: SessionEnvironmentLease) {
        guard state.activeLease == lease else { return }
        resetToBaseEnvironment()
    }

    func resetToBaseEnvironment() {
        state.activeLease = nil
        onReset()
    }
}

@MainActor
private final class FixedSessionEnvironmentRouterState {
    var activeLease: SessionEnvironmentLease?
}
