import Foundation

final class DevelopmentTimeMachine {
    static let shared = DevelopmentTimeMachine()

    private let defaults: UserDefaults
    private let overrideKey = "reguerta_dev_time_machine.override_now_millis"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    var overrideNowMillis: Int64? {
        if defaults.object(forKey: overrideKey) == nil {
            return nil
        }
        return Int64(defaults.integer(forKey: overrideKey))
    }

    func setOverrideNowMillis(_ value: Int64?) {
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
