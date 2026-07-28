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

    func execute(environment: SessionEnvironment) async throws -> CriticalDataFreshnessResolution {
        try Task.checkCancellation()
        let config = try await remoteRepository.getConfig(environment: environment)
        try Task.checkCancellation()

        try Task.checkCancellation()
        let metadata = localRepository.getMetadata()
        try Task.checkCancellation()
        let evaluation = evaluate(
            config: config,
            metadata: metadata,
            nowMillis: nowProvider(),
            environment: environment
        )
        try Task.checkCancellation()

        switch evaluation {
        case .invalidConfig:
            return .invalidConfig
        case .accepted(let metadataToPersist):
            return .fresh(metadataToPersist: metadataToPersist)
        }
    }

    func evaluate(
        config: CriticalDataFreshnessConfig,
        metadata: CriticalDataFreshnessMetadata?,
        nowMillis: Int64,
        environment: SessionEnvironment
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

        guard config.cacheExpirationMinutes <= Int(Int64.max / 60_000) else {
            return .invalidConfig
        }

        let ttlMillis = Int64(config.cacheExpirationMinutes) * 60_000
        let scopedMetadata = metadata?.environment == environment ? metadata : nil
        let isExpired = scopedMetadata == nil || nowMillis - scopedMetadata!.validatedAtMillis >= ttlMillis
        let hasRemoteUpdates = scopedMetadata == nil || CriticalCollection.allCases.contains { collection in
            scopedMetadata!.acknowledgedTimestampsMillis[collection] != remoteTimestamps[collection]
        }

        let metadataToPersist: CriticalDataFreshnessMetadata? = if isExpired || hasRemoteUpdates {
            CriticalDataFreshnessMetadata(
                validatedAtMillis: nowMillis,
                acknowledgedTimestampsMillis: remoteTimestamps,
                environment: environment
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
