import Foundation
import Synchronization

final class DevelopmentTimeMachine: Sendable {
    private static let overrideKey = "reguerta_dev_time_machine.override_now_millis"

    private struct State {
        var overrideNowMillis: Int64?
    }

    @MainActor private let defaults: UserDefaults
    private let state: Mutex<State>
    private let systemNowMillisProvider: @Sendable () -> Int64

    @MainActor
    init(
        defaults: UserDefaults = .standard,
        systemNowMillisProvider: @escaping @Sendable () -> Int64 = {
            Int64(Date().timeIntervalSince1970 * 1_000)
        }
    ) {
        self.defaults = defaults
        self.systemNowMillisProvider = systemNowMillisProvider
        let overrideNowMillis = defaults.object(forKey: Self.overrideKey).map { _ in
            Int64(defaults.integer(forKey: Self.overrideKey))
        }
        self.state = Mutex(
            State(overrideNowMillis: overrideNowMillis)
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
                defaults.set(value, forKey: Self.overrideKey)
            } else {
                defaults.removeObject(forKey: Self.overrideKey)
            }
        }
    }

    func nowMillis() -> Int64 {
        overrideNowMillis ?? systemNowMillisProvider()
    }
}
