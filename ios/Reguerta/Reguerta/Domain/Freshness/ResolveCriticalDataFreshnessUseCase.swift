import Foundation

struct ResolveCriticalDataFreshnessUseCase: Sendable {
    private let remoteRepository: any CriticalDataFreshnessRemoteRepository
    private let localRepository: any CriticalDataFreshnessLocalRepository
    private let refresher: any CriticalDataRefreshing
    private let nowProvider: @Sendable () -> Int64

    init(
        remoteRepository: any CriticalDataFreshnessRemoteRepository,
        localRepository: any CriticalDataFreshnessLocalRepository,
        refresher: any CriticalDataRefreshing = NoOpCriticalDataRefresher(),
        nowProvider: @escaping @Sendable () -> Int64 = {
            Int64(Date().timeIntervalSince1970 * 1000)
        }
    ) {
        self.remoteRepository = remoteRepository
        self.localRepository = localRepository
        self.refresher = refresher
        self.nowProvider = nowProvider
    }

    func execute(scope: CriticalDataRefreshScope) async throws -> CriticalDataFreshnessResolution {
        guard !scope.principalUID.isEmpty,
              !scope.authenticatedMemberID.isEmpty,
              !scope.memberID.isEmpty else {
            return .invalidConfig
        }
        try Task.checkCancellation()
        let config = try await remoteRepository.getConfig(environment: scope.environment)
        try Task.checkCancellation()

        try Task.checkCancellation()
        let metadata = localRepository.getMetadata()
        try Task.checkCancellation()
        let evaluation = evaluate(
            config: config,
            metadata: metadata,
            nowMillis: nowProvider(),
            scope: scope
        )
        try Task.checkCancellation()

        switch evaluation {
        case .invalidConfig:
            return .invalidConfig
        case .accepted(let collectionsToRefresh, let metadataToPersist):
            let refreshedPayload = try await refresher.refresh(
                collections: collectionsToRefresh,
                scope: scope
            )
            try Task.checkCancellation()
            return .fresh(
                metadataToPersist: metadataToPersist,
                refreshedPayload: refreshedPayload
            )
        }
    }

    func evaluate(
        config: CriticalDataFreshnessConfig,
        metadata: CriticalDataFreshnessMetadata?,
        nowMillis: Int64,
        scope: CriticalDataRefreshScope
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
        let scopedMetadata = metadata.flatMap { metadata in
            metadata.environment == scope.environment &&
                metadata.principalUID == scope.principalUID &&
                metadata.authenticatedMemberID == scope.authenticatedMemberID &&
                metadata.memberID == scope.memberID &&
                metadata.canManageMembers == scope.canManageMembers
                ? metadata
                : nil
        }
        let isExpired = scopedMetadata == nil || nowMillis - scopedMetadata!.validatedAtMillis >= ttlMillis
        let changedCollections = Set(CriticalCollection.allCases.filter { collection in
            scopedMetadata?.acknowledgedTimestampsMillis[collection] != remoteTimestamps[collection]
        })
        let collectionsToRefresh = isExpired
            ? Set(CriticalCollection.allCases)
            : changedCollections

        let metadataToPersist: CriticalDataFreshnessMetadata? = if !collectionsToRefresh.isEmpty {
            CriticalDataFreshnessMetadata(
                validatedAtMillis: nowMillis,
                acknowledgedTimestampsMillis: remoteTimestamps,
                environment: scope.environment,
                principalUID: scope.principalUID,
                authenticatedMemberID: scope.authenticatedMemberID,
                memberID: scope.memberID,
                canManageMembers: scope.canManageMembers
            )
        } else {
            nil
        }

        return .accepted(
            collectionsToRefresh: collectionsToRefresh,
            metadataToPersist: metadataToPersist
        )
    }
}

nonisolated enum FreshnessEvaluation: Equatable, Sendable {
    case accepted(
        collectionsToRefresh: Set<CriticalCollection>,
        metadataToPersist: CriticalDataFreshnessMetadata?
    )
    case invalidConfig
}
