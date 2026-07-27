import Foundation

struct RuntimeSessionEnvironmentRouter: SessionEnvironmentRouting {
    var baseEnvironment: SessionEnvironment {
        ReguertaRuntimeEnvironment.baseFirestoreEnvironment
    }

    func applyResolvedEnvironment(_ environment: SessionEnvironment) {
        ReguertaRuntimeEnvironment.applySessionEnvironment(environment)
    }

    func resetToBaseEnvironment() {
        ReguertaRuntimeEnvironment.resetToBaseEnvironment()
    }
}

struct FixedSessionEnvironmentRouter: SessionEnvironmentRouting {
    let baseEnvironment: SessionEnvironment
    private let onApply: @MainActor @Sendable (SessionEnvironment) -> Void
    private let onReset: @MainActor @Sendable () -> Void

    init(
        baseEnvironment: SessionEnvironment = .develop,
        onApply: @escaping @MainActor @Sendable (SessionEnvironment) -> Void = { _ in },
        onReset: @escaping @MainActor @Sendable () -> Void = {}
    ) {
        self.baseEnvironment = baseEnvironment
        self.onApply = onApply
        self.onReset = onReset
    }

    func applyResolvedEnvironment(_ environment: SessionEnvironment) {
        onApply(environment)
    }

    func resetToBaseEnvironment() {
        onReset()
    }
}
