import FirebaseFirestore
import Foundation

struct MyOrderFreshnessFeatureDependencies {
    let resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase
    let criticalDataFreshnessLocalRepository: any CriticalDataFreshnessLocalRepository

    static func live(
        db: Firestore = Firestore.firestore(),
        nowProvider: @escaping @Sendable () -> Int64 = {
            Int64(Date().timeIntervalSince1970 * 1_000)
        }
    ) -> MyOrderFreshnessFeatureDependencies {
        let localRepository = UserDefaultsCriticalDataFreshnessLocalRepository()
        let remoteRepository = makeLiveRemoteRepository(db: db)

        return MyOrderFreshnessFeatureDependencies(
            resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase(
                remoteRepository: remoteRepository,
                localRepository: localRepository,
                nowProvider: nowProvider
            ),
            criticalDataFreshnessLocalRepository: localRepository
        )
    }

    static func preview(
        remoteConfig: CriticalDataFreshnessConfig? = nil,
        nowProvider: @escaping @Sendable () -> Int64 = {
            Int64(Date().timeIntervalSince1970 * 1_000)
        }
    ) -> MyOrderFreshnessFeatureDependencies {
        let localRepository = PreviewCriticalDataFreshnessLocalRepository()

        return MyOrderFreshnessFeatureDependencies(
            resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase(
                remoteRepository: PreviewCriticalDataFreshnessRemoteRepository(config: remoteConfig),
                localRepository: localRepository,
                nowProvider: nowProvider
            ),
            criticalDataFreshnessLocalRepository: localRepository
        )
    }

    private static func makeLiveRemoteRepository(db: Firestore) -> any CriticalDataFreshnessRemoteRepository {
        guard ProcessInfo.processInfo.arguments.contains("-useMockAuth") else {
            return FirestoreCriticalDataFreshnessRemoteRepository(db: db)
        }

        return PreviewCriticalDataFreshnessRemoteRepository(
            config: CriticalDataFreshnessConfig(
                cacheExpirationMinutes: 15,
                remoteTimestampsMillis: Dictionary(
                    uniqueKeysWithValues: CriticalCollection.allCases.map { ($0, 1_000) }
                )
            )
        )
    }
}

private struct PreviewCriticalDataFreshnessRemoteRepository: CriticalDataFreshnessRemoteRepository {
    let config: CriticalDataFreshnessConfig?

    func getConfig() async -> CriticalDataFreshnessConfig? {
        config
    }
}

private actor PreviewCriticalDataFreshnessLocalRepository: CriticalDataFreshnessLocalRepository {
    private var metadata: CriticalDataFreshnessMetadata?

    func getMetadata() async -> CriticalDataFreshnessMetadata? {
        metadata
    }

    func saveMetadata(_ metadata: CriticalDataFreshnessMetadata) async {
        self.metadata = metadata
    }

    func clear() async {
        metadata = nil
    }
}
