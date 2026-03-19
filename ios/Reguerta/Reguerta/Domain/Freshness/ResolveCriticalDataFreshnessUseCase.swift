import Foundation

struct ResolveCriticalDataFreshnessUseCase: Sendable {
    private let remoteRepository: any CriticalDataFreshnessRemoteRepository
    private let localRepository: any CriticalDataFreshnessLocalRepository
    private let nowProvider: @Sendable () -> Int64

    init(
        remoteRepository: any CriticalDataFreshnessRemoteRepository,
        localRepository: any CriticalDataFreshnessLocalRepository,
        nowProvider: @escaping @Sendable () -> Int64 = {
            Int64(Date().timeIntervalSince1970 * 1000)
        }
    ) {
        self.remoteRepository = remoteRepository
        self.localRepository = localRepository
        self.nowProvider = nowProvider
    }

    func execute() async -> CriticalDataFreshnessResolution {
        guard let config = await remoteRepository.getConfig() else {
            return .invalidConfig
        }

        let metadata = await localRepository.getMetadata()
        let evaluation = evaluate(
            config: config,
            metadata: metadata,
            nowMillis: nowProvider()
        )

        switch evaluation {
        case .invalidConfig:
            return .invalidConfig
        case .accepted(let metadataToPersist):
            if let metadataToPersist {
                await localRepository.saveMetadata(metadataToPersist)
            }
            return .fresh
        }
    }

    func evaluate(
        config: CriticalDataFreshnessConfig,
        metadata: CriticalDataFreshnessMetadata?,
        nowMillis: Int64
    ) -> FreshnessEvaluation {
        guard config.cacheExpirationMinutes > 0 else {
            return .invalidConfig
        }

        let remoteTimestamps = config.remoteTimestampsMillis
        guard CriticalCollection.allCases.allSatisfy({ collection in
            if let value = remoteTimestamps[collection] {
                return value > 0
            }
            return false
        }) else {
            return .invalidConfig
        }

        let ttlMillis = Int64(config.cacheExpirationMinutes) * 60_000
        let isExpired = metadata == nil || nowMillis - metadata!.validatedAtMillis >= ttlMillis
        let hasRemoteUpdates = metadata == nil || CriticalCollection.allCases.contains { collection in
            metadata!.acknowledgedTimestampsMillis[collection] != remoteTimestamps[collection]
        }

        let metadataToPersist: CriticalDataFreshnessMetadata? = if isExpired || hasRemoteUpdates {
            CriticalDataFreshnessMetadata(
                validatedAtMillis: nowMillis,
                acknowledgedTimestampsMillis: remoteTimestamps
            )
        } else {
            nil
        }

        return .accepted(metadataToPersist: metadataToPersist)
    }
}

enum FreshnessEvaluation: Equatable, Sendable {
    case accepted(metadataToPersist: CriticalDataFreshnessMetadata?)
    case invalidConfig
}
