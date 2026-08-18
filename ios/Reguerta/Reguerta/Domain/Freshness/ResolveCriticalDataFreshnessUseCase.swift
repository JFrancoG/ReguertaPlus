import Foundation

struct ResolveCriticalDataFreshnessUseCase {
    private let storedRemoteRepository: any CriticalDataFreshnessRemoteRepository
    private let storedLocalRepository: any CriticalDataFreshnessLocalRepository
    private let storedRefresher: any CriticalDataRefreshing
    private let storedNowProvider: @Sendable () -> Int64

    /// Resolves which critical collections must be refreshed for an authenticated scope.
    ///
    /// The use case validates the scope and remote configuration, evaluates locally
    /// acknowledged timestamps, and refreshes the selected collections before returning any
    /// metadata that can acknowledge them. It does not persist that metadata itself, allowing
    /// the caller to acknowledge remote timestamps only after the refresh completes.
    ///
    /// - Parameter scope: The environment, identities, and permissions that own the local cache.
    /// - Returns: `.invalidConfig` for an unusable contract, or `.fresh` with the refreshed
    ///   payload and optional metadata ready for persistence.
    /// - Throws: `CancellationError` or an error from the remote configuration or refresher.
    func execute(scope: CriticalDataRefreshScope) async throws -> CriticalDataFreshnessResolution {
        guard !scope.principalUID.isEmpty,
              !scope.authenticatedMemberID.isEmpty,
              !scope.memberID.isEmpty else {
            return .invalidConfig
        }
        try Task.checkCancellation()
        let config = try await storedRemoteRepository.getConfig(environment: scope.environment)
        try Task.checkCancellation()

        try Task.checkCancellation()
        let metadata = storedLocalRepository.getMetadata()
        try Task.checkCancellation()
        let evaluation = evaluate(
            config: config,
            metadata: metadata,
            nowMillis: storedNowProvider(),
            scope: scope
        )
        try Task.checkCancellation()

        switch evaluation {
        case .invalidConfig:
            return .invalidConfig
        case .accepted(let collectionsToRefresh, let metadataToPersist):
            let refreshedPayload = try await storedRefresher.refresh(
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

    /// Evaluates cache freshness without performing I/O.
    ///
    /// Metadata belongs to the exact environment, Firebase principal, authenticated member,
    /// routed member, and permission scope that created it; a mismatch is treated as no cache.
    /// Expired caches refresh every critical collection, while unexpired caches refresh only
    /// collections whose remote timestamps changed. Metadata is emitted only when a refresh is
    /// required so that acknowledgement remains coupled to refreshed data.
    ///
    /// - Parameters:
    ///   - config: Remote timestamps and cache lifetime, expressed in minutes.
    ///   - metadata: The last locally acknowledged timestamps, if any.
    ///   - nowMillis: The current time in Unix milliseconds.
    ///   - scope: The identities and permissions that own the evaluation.
    /// - Returns: The collections and metadata to refresh, or `.invalidConfig` when the TTL or
    ///   any required remote timestamp is invalid.
    func evaluate(
        config: CriticalDataFreshnessConfig,
        metadata: CriticalDataFreshnessMetadata?,
        nowMillis: Int64,
        scope: CriticalDataRefreshScope
    ) -> FreshnessEvaluation {
        guard config.cacheExpirationMinutes > 0 else { return .invalidConfig }

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

extension ResolveCriticalDataFreshnessUseCase {
    init(
        remoteRepository: any CriticalDataFreshnessRemoteRepository,
        localRepository: any CriticalDataFreshnessLocalRepository,
        refresher: any CriticalDataRefreshing = NoOpCriticalDataRefresher(),
        nowProvider: @escaping @Sendable () -> Int64 = {
            Int64(Date().timeIntervalSince1970 * 1000)
        }
    ) {
        self.storedRemoteRepository = remoteRepository
        self.storedLocalRepository = localRepository
        self.storedRefresher = refresher
        self.storedNowProvider = nowProvider
    }
}

nonisolated enum FreshnessEvaluation: Equatable, Sendable {
    case accepted(
        collectionsToRefresh: Set<CriticalCollection>,
        metadataToPersist: CriticalDataFreshnessMetadata?
    )
    case invalidConfig
}
