import Foundation

struct UserDefaultsCriticalDataFreshnessLocalRepository: CriticalDataFreshnessLocalRepository {
    private let userDefaults: UserDefaults

    init(userDefaults: UserDefaults = .standard) {
        self.userDefaults = userDefaults
    }

    func getMetadata() async -> CriticalDataFreshnessMetadata? {
        let validatedAtMillis = (userDefaults.object(forKey: Keys.validatedAt) as? NSNumber)?.int64Value
            ?? Int64(userDefaults.integer(forKey: Keys.validatedAt))
        guard validatedAtMillis > 0 else {
            return nil
        }

        var timestamps: [CriticalCollection: Int64] = [:]
        for collection in CriticalCollection.allCases {
            let value = (userDefaults.object(forKey: timestampKey(for: collection)) as? NSNumber)?.int64Value
                ?? Int64(userDefaults.integer(forKey: timestampKey(for: collection)))
            guard value > 0 else {
                return nil
            }
            timestamps[collection] = value
        }

        return CriticalDataFreshnessMetadata(
            validatedAtMillis: validatedAtMillis,
            acknowledgedTimestampsMillis: timestamps
        )
    }

    func saveMetadata(_ metadata: CriticalDataFreshnessMetadata) async {
        userDefaults.set(metadata.validatedAtMillis, forKey: Keys.validatedAt)
        for (collection, timestamp) in metadata.acknowledgedTimestampsMillis {
            userDefaults.set(timestamp, forKey: timestampKey(for: collection))
        }
    }

    func clear() async {
        userDefaults.removeObject(forKey: Keys.validatedAt)
        for collection in CriticalCollection.allCases {
            userDefaults.removeObject(forKey: timestampKey(for: collection))
        }
    }
}

private enum Keys {
    static let validatedAt = "critical_data_freshness.validated_at"
}

private func timestampKey(for collection: CriticalCollection) -> String {
    "critical_data_freshness.timestamp.\(collection.rawValue)"
}
