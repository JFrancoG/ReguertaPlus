import FirebaseFirestore
import Foundation

struct FirestoreCriticalDataFreshnessRemoteRepository: CriticalDataFreshnessRemoteRepository {
    private let db: Firestore
    private let environment: ReguertaFirestoreEnvironment

    init(
        db: Firestore = Firestore.firestore(),
        environment: ReguertaFirestoreEnvironment = .develop
    ) {
        self.db = db
        self.environment = environment
    }

    func getConfig() async -> CriticalDataFreshnessConfig? {
        do {
            let snapshot = try await db
                .reguertaDocument(.global, in: .config, environment: environment)
                .getDocument()

            guard let data = snapshot.data(),
                  let cacheExpirationMinutes = (data["cacheExpirationMinutes"] as? NSNumber)?.intValue,
                  let lastTimestamps = data["lastTimestamps"] as? [String: Any]
            else {
                return nil
            }

            var remoteTimestamps: [CriticalCollection: Int64] = [:]
            for collection in CriticalCollection.allCases {
                guard let timestamp = lastTimestamps[collection.rawValue] as? Timestamp else {
                    continue
                }
                remoteTimestamps[collection] = Int64(timestamp.dateValue().timeIntervalSince1970 * 1000)
            }

            return CriticalDataFreshnessConfig(
                cacheExpirationMinutes: cacheExpirationMinutes,
                remoteTimestampsMillis: remoteTimestamps
            )
        } catch {
            return nil
        }
    }
}
