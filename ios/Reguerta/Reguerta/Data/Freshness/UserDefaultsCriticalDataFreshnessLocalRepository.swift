import Foundation

@MainActor
struct UserDefaultsCriticalDataFreshnessLocalRepository: CriticalDataFreshnessLocalRepository {
    private let userDefaults: UserDefaults

    init(userDefaults: UserDefaults = .standard) {
        self.userDefaults = userDefaults
    }

    var writeGeneration: UInt64 {
        (userDefaults.object(forKey: Keys.writeGeneration) as? NSNumber)?.uint64Value ?? 0
    }

    func getMetadata() -> CriticalDataFreshnessMetadata? {
        let validatedAtMillis = (userDefaults.object(forKey: Keys.validatedAt) as? NSNumber)?.int64Value
            ?? Int64(userDefaults.integer(forKey: Keys.validatedAt))
        guard validatedAtMillis > 0 else { return nil }
        guard let environmentRawValue = userDefaults.string(forKey: Keys.environment),
              let environment = SessionEnvironment(rawValue: environmentRawValue)
        else {
            return nil
        }
        guard let principalUID = userDefaults.string(forKey: Keys.principalUID),
              !principalUID.isEmpty,
              let authenticatedMemberID = userDefaults.string(forKey: Keys.authenticatedMemberID),
              !authenticatedMemberID.isEmpty,
              let memberID = userDefaults.string(forKey: Keys.memberID),
              !memberID.isEmpty,
              let canManageMembers = userDefaults.object(forKey: Keys.canManageMembers) as? Bool
        else {
            return nil
        }

        var timestamps: [CriticalCollection: Int64] = [:]
        for collection in CriticalCollection.allCases {
            let value = (userDefaults.object(forKey: timestampKey(for: collection)) as? NSNumber)?.int64Value
                ?? Int64(userDefaults.integer(forKey: timestampKey(for: collection)))
            guard value > 0 else { return nil }
            timestamps[collection] = value
        }

        return CriticalDataFreshnessMetadata(
            validatedAtMillis: validatedAtMillis,
            acknowledgedTimestampsMillis: timestamps,
            environment: environment,
            principalUID: principalUID,
            authenticatedMemberID: authenticatedMemberID,
            memberID: memberID,
            canManageMembers: canManageMembers
        )
    }

    func saveMetadata(
        _ metadata: CriticalDataFreshnessMetadata,
        ifWriteGeneration expectedWriteGeneration: UInt64
    ) -> Bool {
        guard writeGeneration == expectedWriteGeneration else { return false }
        userDefaults.set(metadata.validatedAtMillis, forKey: Keys.validatedAt)
        userDefaults.set(metadata.environment.rawValue, forKey: Keys.environment)
        userDefaults.set(metadata.principalUID, forKey: Keys.principalUID)
        userDefaults.set(metadata.authenticatedMemberID, forKey: Keys.authenticatedMemberID)
        userDefaults.set(metadata.memberID, forKey: Keys.memberID)
        userDefaults.set(metadata.canManageMembers, forKey: Keys.canManageMembers)
        for (collection, timestamp) in metadata.acknowledgedTimestampsMillis {
            userDefaults.set(timestamp, forKey: timestampKey(for: collection))
        }
        return true
    }

    func clear() throws {
        userDefaults.set(
            NSNumber(value: writeGeneration &+ 1),
            forKey: Keys.writeGeneration
        )
        userDefaults.removeObject(forKey: Keys.validatedAt)
        userDefaults.removeObject(forKey: Keys.environment)
        userDefaults.removeObject(forKey: Keys.principalUID)
        userDefaults.removeObject(forKey: Keys.authenticatedMemberID)
        userDefaults.removeObject(forKey: Keys.memberID)
        userDefaults.removeObject(forKey: Keys.canManageMembers)
        for collection in CriticalCollection.allCases {
            userDefaults.removeObject(forKey: timestampKey(for: collection))
        }
    }
}

private enum Keys {
    static let writeGeneration = "critical_data_freshness.write_generation"
    static let validatedAt = "critical_data_freshness.validated_at"
    static let environment = "critical_data_freshness.environment"
    static let principalUID = "critical_data_freshness.principal_uid"
    static let authenticatedMemberID = "critical_data_freshness.authenticated_member_id"
    static let memberID = "critical_data_freshness.member_id"
    static let canManageMembers = "critical_data_freshness.can_manage_members"
}

private func timestampKey(for collection: CriticalCollection) -> String {
    "critical_data_freshness.timestamp.\(collection.rawValue)"
}
