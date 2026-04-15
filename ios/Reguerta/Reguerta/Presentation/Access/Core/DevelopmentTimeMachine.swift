import Foundation

final class DevelopmentTimeMachine: @unchecked Sendable {
    static let shared = DevelopmentTimeMachine()

    private let defaults: UserDefaults
    private let lock = NSLock()
    private let overrideKey = "reguerta_dev_time_machine.override_now_millis"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    var overrideNowMillis: Int64? {
        lock.lock()
        defer { lock.unlock() }
        guard defaults.object(forKey: overrideKey) != nil else {
            return nil
        }
        return Int64(defaults.integer(forKey: overrideKey))
    }

    func setOverrideNowMillis(_ value: Int64?) {
        lock.lock()
        defer { lock.unlock() }
        if let value {
            defaults.set(value, forKey: overrideKey)
        } else {
            defaults.removeObject(forKey: overrideKey)
        }
    }

    func nowMillis() -> Int64 {
        overrideNowMillis ?? Int64(Date().timeIntervalSince1970 * 1_000)
    }
}
