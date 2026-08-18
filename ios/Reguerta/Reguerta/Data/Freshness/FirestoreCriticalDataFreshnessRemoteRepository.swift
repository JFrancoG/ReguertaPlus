import FirebaseFirestore
import Foundation

struct FirestoreCriticalDataFreshnessRemoteRepository: CriticalDataFreshnessRemoteRepository {
    private let storedDB: Firestore

    func getConfig(environment: SessionEnvironment) async throws -> CriticalDataFreshnessConfig {
        do {
            let snapshot = try await storedDB
                .reguertaDocument(.memberConfiguration, in: .config, environment: environment)
                .getDocument(source: .server)

            guard snapshot.exists else { throw RepositoryError.notFound(resource: "config.member") }
            guard let data = snapshot.data() else { throw RepositoryError.invalidData(resource: "config.member") }
            return try Self.config(data: data)
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: "config.member")
        }
    }

    nonisolated static func config(data: [String: Any]) throws -> CriticalDataFreshnessConfig {
        guard let cacheExpirationNumber = data["cacheExpirationMinutes"] as? NSNumber,
              CFGetTypeID(cacheExpirationNumber) != CFBooleanGetTypeID(),
              cacheExpirationNumber.doubleValue.rounded() == cacheExpirationNumber.doubleValue,
              cacheExpirationNumber.int64Value > 0,
              cacheExpirationNumber.int64Value <= Int64(Int.max),
              let lastTimestamps = data["lastTimestamps"] as? [String: Any]
        else {
            throw RepositoryError.invalidData(resource: "config.member")
        }

        var remoteTimestamps: [CriticalCollection: Int64] = [:]
        for collection in CriticalCollection.allCases {
            guard let timestamp = lastTimestamps[collection.rawValue] as? Timestamp else {
                throw RepositoryError.invalidData(resource: "config.member.lastTimestamps")
            }
            let milliseconds = Int64(timestamp.dateValue().timeIntervalSince1970 * 1_000)
            guard milliseconds > 0 else { throw RepositoryError.invalidData(resource: "config.member.lastTimestamps") }
            remoteTimestamps[collection] = milliseconds
        }

        return CriticalDataFreshnessConfig(
            cacheExpirationMinutes: cacheExpirationNumber.intValue,
            remoteTimestampsMillis: remoteTimestamps
        )
    }
}

extension FirestoreCriticalDataFreshnessRemoteRepository {
    init(db: Firestore) {
        self.storedDB = db
    }
}
