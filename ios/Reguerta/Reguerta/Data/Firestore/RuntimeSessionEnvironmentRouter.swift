import Foundation

struct RuntimeSessionEnvironmentRouter: SessionEnvironmentRouting {
    private let storedTransitionSignal: SessionEnvironmentRoutingSignal

    var transitionSignal: SessionEnvironmentRoutingSignal { storedTransitionSignal }

    var baseEnvironment: SessionEnvironment {
        ReguertaRuntimeEnvironment.baseFirestoreEnvironment
    }

    func applyResolvedEnvironment(_ environment: SessionEnvironment, lease: SessionEnvironmentLease) {
        ReguertaRuntimeEnvironment.applySessionEnvironment(environment, lease: lease)
        storedTransitionSignal.publish(
            environment: ReguertaRuntimeEnvironment.currentFirestoreEnvironment
        )
    }

    func resetToBaseEnvironment(ifOwnedBy lease: SessionEnvironmentLease) {
        ReguertaRuntimeEnvironment.resetToBaseEnvironment(ifOwnedBy: lease)
        storedTransitionSignal.publish(
            environment: ReguertaRuntimeEnvironment.currentFirestoreEnvironment
        )
    }

    func resetToBaseEnvironment() {
        ReguertaRuntimeEnvironment.resetToBaseEnvironment()
        storedTransitionSignal.publish(
            environment: ReguertaRuntimeEnvironment.currentFirestoreEnvironment
        )
    }
}

struct FixedSessionEnvironmentRouter: SessionEnvironmentRouting {
    let baseEnvironment: SessionEnvironment
    let transitionSignal: SessionEnvironmentRoutingSignal
    private let state: FixedSessionEnvironmentRouterState
    private let onApply: @MainActor @Sendable (SessionEnvironment) -> Void
    private let onReset: @MainActor @Sendable () -> Void

    func applyResolvedEnvironment(_ environment: SessionEnvironment, lease: SessionEnvironmentLease) {
        state.activeLease = lease
        onApply(environment)
        transitionSignal.publish(environment: environment)
    }

    func resetToBaseEnvironment(ifOwnedBy lease: SessionEnvironmentLease) {
        guard state.activeLease == lease else { return }
        resetToBaseEnvironment()
    }

    func resetToBaseEnvironment() {
        state.activeLease = nil
        onReset()
        transitionSignal.publish(environment: baseEnvironment)
    }
}

extension RuntimeSessionEnvironmentRouter {
    init(transitionSignal: SessionEnvironmentRoutingSignal? = nil) {
        self.storedTransitionSignal = transitionSignal ?? SessionEnvironmentRoutingSignal(
            environment: ReguertaRuntimeEnvironment.currentFirestoreEnvironment
        )
    }
}

extension FixedSessionEnvironmentRouter {
    init(
        baseEnvironment: SessionEnvironment = .develop,
        onApply: @escaping @MainActor @Sendable (SessionEnvironment) -> Void = { _ in },
        onReset: @escaping @MainActor @Sendable () -> Void = {}
    ) {
        self.baseEnvironment = baseEnvironment
        self.transitionSignal = SessionEnvironmentRoutingSignal(environment: baseEnvironment)
        self.state = FixedSessionEnvironmentRouterState()
        self.onApply = onApply
        self.onReset = onReset
    }
}

@MainActor
private final class FixedSessionEnvironmentRouterState {
    var activeLease: SessionEnvironmentLease?
}
