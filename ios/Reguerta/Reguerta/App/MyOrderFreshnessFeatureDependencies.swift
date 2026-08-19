import FirebaseFirestore
import Foundation

struct MyOrderFreshnessFeatureDependencies {
    let resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase
    let criticalDataFreshnessLocalRepository: any CriticalDataFreshnessLocalRepository

    @MainActor
    static func live(
        db: Firestore = Firestore.firestore(),
        localRepository: any CriticalDataFreshnessLocalRepository =
            UserDefaultsCriticalDataFreshnessLocalRepository(),
        nowProvider: @escaping @Sendable () -> Int64 = {
            Int64(Date().timeIntervalSince1970 * 1_000)
        }
    ) -> MyOrderFreshnessFeatureDependencies {
        let firebaseAppName = db.app.name
        let remoteRepository = makeLiveRemoteRepository(db: db)

        return MyOrderFreshnessFeatureDependencies(
            resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase(
                remoteRepository: remoteRepository,
                localRepository: localRepository,
                refresher: FirestoreCriticalDataRefresher(firebaseAppName: firebaseAppName),
                nowProvider: nowProvider
            ),
            criticalDataFreshnessLocalRepository: localRepository
        )
    }

    @MainActor
    static func preview(
        remoteConfig: CriticalDataFreshnessConfig? = nil,
        localRepository: (any CriticalDataFreshnessLocalRepository)? = nil,
        nowProvider: @escaping @Sendable () -> Int64 = {
            Int64(Date().timeIntervalSince1970 * 1_000)
        }
    ) -> MyOrderFreshnessFeatureDependencies {
        let localRepository = localRepository ?? PreviewCriticalDataFreshnessLocalRepository()

        return MyOrderFreshnessFeatureDependencies(
            resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase(
                remoteRepository: PreviewCriticalDataFreshnessRemoteRepository(config: remoteConfig),
                localRepository: localRepository,
                nowProvider: nowProvider
            ),
            criticalDataFreshnessLocalRepository: localRepository
        )
    }

    @MainActor
    private static func makeLiveRemoteRepository(db: Firestore) -> any CriticalDataFreshnessRemoteRepository {
        guard ProcessInfo.processInfo.arguments.contains("-useMockAuth") else {
            return FirestoreCriticalDataFreshnessRemoteRepository(firebaseAppName: db.app.name)
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

    func getConfig(environment: SessionEnvironment) async throws -> CriticalDataFreshnessConfig {
        guard let config else {
            throw RepositoryError.notFound(resource: "config.member")
        }
        return config
    }
}

@MainActor
private final class PreviewCriticalDataFreshnessLocalRepository: CriticalDataFreshnessLocalRepository {
    private var metadata: CriticalDataFreshnessMetadata?
    private(set) var writeGeneration: UInt64 = 0

    func getMetadata() -> CriticalDataFreshnessMetadata? { metadata }

    func saveMetadata(
        _ metadata: CriticalDataFreshnessMetadata,
        ifWriteGeneration expectedWriteGeneration: UInt64
    ) -> Bool {
        guard writeGeneration == expectedWriteGeneration else { return false }
        self.metadata = metadata
        return true
    }

    func clear() throws {
        writeGeneration &+= 1
        metadata = nil
    }
}
