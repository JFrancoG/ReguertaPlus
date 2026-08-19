import Foundation
import Synchronization

final class DevelopmentTimeMachine: Sendable {
    private static let overrideKey = "reguerta_dev_time_machine.override_now_millis"

    private struct State {
        var overrideNowMillis: Int64?
    }

    @MainActor private let defaults: UserDefaults?
    private let state: Mutex<State>
    private let systemNowMillisProvider: @Sendable () -> Int64

    /// Creates a clock whose typed launch seed takes precedence over any persisted override.
    ///
    /// A non-`nil` defaults store restores and persists mutations. Passing `nil` keeps both the seed and later
    /// mutations private to the owning graph.
    @MainActor
    init(
        defaults: UserDefaults? = .standard,
        initialOverrideNowMillis: Int64? = nil,
        systemNowMillisProvider: @escaping @Sendable () -> Int64 = {
            Int64(Date().timeIntervalSince1970 * 1_000)
        }
    ) {
        self.defaults = defaults
        self.systemNowMillisProvider = systemNowMillisProvider
        let persistedOverrideNowMillis = defaults?.object(forKey: Self.overrideKey).map { _ in
            Int64(defaults?.integer(forKey: Self.overrideKey) ?? 0)
        }
        self.state = Mutex(
            State(overrideNowMillis: initialOverrideNowMillis ?? persistedOverrideNowMillis)
        )
    }

    var overrideNowMillis: Int64? {
        state.withLock { $0.overrideNowMillis }
    }

    @MainActor
    func setOverrideNowMillis(_ value: Int64?) {
        state.withLock { state in
            state.overrideNowMillis = value
            if let value {
                defaults?.set(value, forKey: Self.overrideKey)
            } else {
                defaults?.removeObject(forKey: Self.overrideKey)
            }
        }
    }

    func nowMillis() -> Int64 {
        overrideNowMillis ?? systemNowMillisProvider()
    }
}

extension DevelopmentTimeMachine {
    /// Creates a graph-local clock that never restores or persists shared state.
    ///
    /// Production keeps using the default persistent initializer. Preview and UI-test graphs may seed a typed launch
    /// override, but later mutations remain private to that graph.
    @MainActor static func transient(initialOverrideNowMillis: Int64? = nil) -> DevelopmentTimeMachine {
        DevelopmentTimeMachine(defaults: nil, initialOverrideNowMillis: initialOverrideNowMillis)
    }
}
