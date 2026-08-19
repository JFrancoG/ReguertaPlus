import Foundation

@MainActor
final class RuntimeSessionEnvironmentRouter: SessionEnvironmentRouting {
    let environmentStore: RuntimeSessionEnvironmentStore

    init(environmentStore: RuntimeSessionEnvironmentStore = RuntimeSessionEnvironmentStore()) {
        self.environmentStore = environmentStore
    }

    var baseEnvironment: SessionEnvironment { environmentStore.baseEnvironment }
    var environmentSnapshotProvider: any SessionEnvironmentSnapshotProviding { environmentStore }
    var transitionSignal: SessionEnvironmentRoutingSignal { environmentStore.transitionSignal }

    func applyResolvedEnvironment(_ environment: SessionEnvironment, lease: SessionEnvironmentLease) {
        let snapshot = environmentStore.apply(environment, lease: lease)
        transitionSignal.publish(environment: snapshot.environment)
    }

    func resetToBaseEnvironment(ifOwnedBy lease: SessionEnvironmentLease) {
        guard let snapshot = environmentStore.reset(ifOwnedBy: lease) else { return }
        transitionSignal.publish(environment: snapshot.environment)
    }

    func resetToBaseEnvironment() {
        let snapshot = environmentStore.reset()
        transitionSignal.publish(environment: snapshot.environment)
    }
}

struct FixedSessionEnvironmentRouter: SessionEnvironmentRouting {
    private let environmentStore: RuntimeSessionEnvironmentStore
    private let onApply: @MainActor @Sendable (SessionEnvironment) -> Void
    private let onReset: @MainActor @Sendable () -> Void

    var baseEnvironment: SessionEnvironment { environmentStore.baseEnvironment }
    var environmentSnapshotProvider: any SessionEnvironmentSnapshotProviding { environmentStore }
    var transitionSignal: SessionEnvironmentRoutingSignal { environmentStore.transitionSignal }

    func applyResolvedEnvironment(_ environment: SessionEnvironment, lease: SessionEnvironmentLease) {
        let snapshot = environmentStore.apply(environment, lease: lease)
        onApply(environment)
        transitionSignal.publish(environment: snapshot.environment)
    }

    func resetToBaseEnvironment(ifOwnedBy lease: SessionEnvironmentLease) {
        guard let snapshot = environmentStore.reset(ifOwnedBy: lease) else { return }
        onReset()
        transitionSignal.publish(environment: snapshot.environment)
    }

    func resetToBaseEnvironment() {
        let snapshot = environmentStore.reset()
        onReset()
        transitionSignal.publish(environment: snapshot.environment)
    }
}

extension FixedSessionEnvironmentRouter {
    @MainActor
    init(
        baseEnvironment: SessionEnvironment = .develop,
        onApply: @escaping @MainActor @Sendable (SessionEnvironment) -> Void = { _ in },
        onReset: @escaping @MainActor @Sendable () -> Void = {}
    ) {
        self.environmentStore = RuntimeSessionEnvironmentStore(baseEnvironment: baseEnvironment)
        self.onApply = onApply
        self.onReset = onReset
    }
}
