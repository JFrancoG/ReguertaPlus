import Foundation

@MainActor
struct UserDefaultsCriticalDataFreshnessLocalRepository: CriticalDataFreshnessLocalRepository {
    private let storedUserDefaults: UserDefaults

    var writeGeneration: UInt64 {
        (storedUserDefaults.object(forKey: Keys.writeGeneration) as? NSNumber)?.uint64Value ?? 0
    }

    func getMetadata() -> CriticalDataFreshnessMetadata? {
        let validatedAtMillis = (storedUserDefaults.object(forKey: Keys.validatedAt) as? NSNumber)?.int64Value
            ?? Int64(storedUserDefaults.integer(forKey: Keys.validatedAt))
        guard validatedAtMillis > 0 else { return nil }
        guard let environmentRawValue = storedUserDefaults.string(forKey: Keys.environment),
              let environment = SessionEnvironment(rawValue: environmentRawValue)
        else {
            return nil
        }
        guard let principalUID = storedUserDefaults.string(forKey: Keys.principalUID),
              !principalUID.isEmpty,
              let authenticatedMemberID = storedUserDefaults.string(forKey: Keys.authenticatedMemberID),
              !authenticatedMemberID.isEmpty,
              let memberID = storedUserDefaults.string(forKey: Keys.memberID),
              !memberID.isEmpty,
              let canManageMembers = storedUserDefaults.object(forKey: Keys.canManageMembers) as? Bool
        else {
            return nil
        }

        var timestamps: [CriticalCollection: Int64] = [:]
        for collection in CriticalCollection.allCases {
            let value = (storedUserDefaults.object(forKey: timestampKey(for: collection)) as? NSNumber)?.int64Value
                ?? Int64(storedUserDefaults.integer(forKey: timestampKey(for: collection)))
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
        storedUserDefaults.set(metadata.validatedAtMillis, forKey: Keys.validatedAt)
        storedUserDefaults.set(metadata.environment.rawValue, forKey: Keys.environment)
        storedUserDefaults.set(metadata.principalUID, forKey: Keys.principalUID)
        storedUserDefaults.set(metadata.authenticatedMemberID, forKey: Keys.authenticatedMemberID)
        storedUserDefaults.set(metadata.memberID, forKey: Keys.memberID)
        storedUserDefaults.set(metadata.canManageMembers, forKey: Keys.canManageMembers)
        for (collection, timestamp) in metadata.acknowledgedTimestampsMillis {
            storedUserDefaults.set(timestamp, forKey: timestampKey(for: collection))
        }
        return true
    }

    func clear() throws {
        storedUserDefaults.set(
            NSNumber(value: writeGeneration &+ 1),
            forKey: Keys.writeGeneration
        )
        storedUserDefaults.removeObject(forKey: Keys.validatedAt)
        storedUserDefaults.removeObject(forKey: Keys.environment)
        storedUserDefaults.removeObject(forKey: Keys.principalUID)
        storedUserDefaults.removeObject(forKey: Keys.authenticatedMemberID)
        storedUserDefaults.removeObject(forKey: Keys.memberID)
        storedUserDefaults.removeObject(forKey: Keys.canManageMembers)
        for collection in CriticalCollection.allCases {
            storedUserDefaults.removeObject(forKey: timestampKey(for: collection))
        }
    }
}

extension UserDefaultsCriticalDataFreshnessLocalRepository {
    init(userDefaults: UserDefaults = .standard) {
        self.storedUserDefaults = userDefaults
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
