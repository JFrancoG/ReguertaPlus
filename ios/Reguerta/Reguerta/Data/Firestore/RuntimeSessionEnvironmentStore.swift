import Synchronization

/// Owns one dependency graph's effective Firebase environment and lease.
///
/// Reads and transitions are synchronous so a session operation can invalidate
/// routing without suspending. Callers starting asynchronous work capture one
/// snapshot and retain it for the complete operation.
final class RuntimeSessionEnvironmentStore: SessionEnvironmentSnapshotProviding, Sendable {
    private struct State {
        var environment: SessionEnvironment
        var activeLease: SessionEnvironmentLease?
    }

    let baseEnvironment: SessionEnvironment
    let transitionSignal: SessionEnvironmentRoutingSignal
    private let state: Mutex<State>

    func snapshot() -> SessionEnvironmentSnapshot {
        state.withLock { state in
            SessionEnvironmentSnapshot(environment: state.environment)
        }
    }

    @discardableResult
    func apply(_ environment: SessionEnvironment, lease: SessionEnvironmentLease) -> SessionEnvironmentSnapshot {
        state.withLock { state in
            state.environment = environment
            state.activeLease = lease
            return SessionEnvironmentSnapshot(environment: state.environment)
        }
    }

    @discardableResult
    func reset(ifOwnedBy lease: SessionEnvironmentLease) -> SessionEnvironmentSnapshot? {
        state.withLock { state in
            guard state.activeLease == lease else { return nil }
            state.environment = baseEnvironment
            state.activeLease = nil
            return SessionEnvironmentSnapshot(environment: state.environment)
        }
    }

    @discardableResult
    func reset() -> SessionEnvironmentSnapshot {
        state.withLock { state in
            state.environment = baseEnvironment
            state.activeLease = nil
            return SessionEnvironmentSnapshot(environment: state.environment)
        }
    }

    @MainActor
    init(baseEnvironment: SessionEnvironment = .applicationBase) {
        self.baseEnvironment = baseEnvironment
        self.transitionSignal = SessionEnvironmentRoutingSignal(environment: baseEnvironment)
        self.state = Mutex(
            State(
                environment: baseEnvironment,
                activeLease: nil
            )
        )
    }
}

extension SessionEnvironment {
    static var applicationBase: SessionEnvironment {
        #if DEBUG
        .develop
        #else
        .production
        #endif
    }
}
