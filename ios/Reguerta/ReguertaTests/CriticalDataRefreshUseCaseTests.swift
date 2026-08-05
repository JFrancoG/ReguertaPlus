import Foundation
import Testing

@testable import Reguerta

@MainActor
struct CriticalDataRefreshUseCaseTests {
    @Test func timestampDeltaRefreshesOnlyChangedCollectionsBeforeReturningAcknowledgement() async throws {
        let originalTimestamps = criticalTimestamps(defaultValue: 1_000)
        var remoteTimestamps = originalTimestamps
        remoteTimestamps[.products] = 2_000
        remoteTimestamps[.orderlines] = 3_000
        let scope = criticalRefreshScope()
        let localRepository = SeededCriticalDataFreshnessLocalRepository(
            metadata: criticalMetadata(
                timestamps: originalTimestamps,
                scope: scope,
                validatedAtMillis: 5_000
            )
        )
        let refresher = RecordingCriticalDataRefresher()
        let useCase = ResolveCriticalDataFreshnessUseCase(
            remoteRepository: FixedCriticalDataFreshnessRemoteRepository(
                config: CriticalDataFreshnessConfig(
                    cacheExpirationMinutes: 15,
                    remoteTimestampsMillis: remoteTimestamps
                )
            ),
            localRepository: localRepository,
            refresher: refresher,
            nowProvider: { 6_000 }
        )

        let resolution = try await useCase.execute(scope: scope)

        #expect(
            await refresher.recordedCollections() == Set([
                CriticalCollection.products,
                CriticalCollection.orderlines
            ])
        )
        guard case .fresh(let metadataToPersist, _) = resolution else {
            Issue.record("Expected a fresh resolution")
            return
        }
        #expect(
            metadataToPersist == criticalMetadata(
                timestamps: remoteTimestamps,
                scope: scope,
                validatedAtMillis: 6_000
            )
        )
        #expect(localRepository.getMetadata()?.acknowledgedTimestampsMillis == originalTimestamps)
    }

    @Test func expiredTTLRefreshesAllCriticalCollections() async throws {
        let timestamps = criticalTimestamps(defaultValue: 1_000)
        let scope = criticalRefreshScope()
        let refresher = RecordingCriticalDataRefresher()
        let useCase = ResolveCriticalDataFreshnessUseCase(
            remoteRepository: FixedCriticalDataFreshnessRemoteRepository(
                config: CriticalDataFreshnessConfig(
                    cacheExpirationMinutes: 15,
                    remoteTimestampsMillis: timestamps
                )
            ),
            localRepository: SeededCriticalDataFreshnessLocalRepository(
                metadata: criticalMetadata(
                    timestamps: timestamps,
                    scope: scope,
                    validatedAtMillis: 1_000
                )
            ),
            refresher: refresher,
            nowProvider: { 901_000 }
        )

        _ = try await useCase.execute(scope: scope)

        #expect(await refresher.recordedCollections() == Set(CriticalCollection.allCases))
    }

    @Test func metadataFromAnotherMemberForcesFullRefresh() async throws {
        let timestamps = criticalTimestamps(defaultValue: 1_000)
        let scope = criticalRefreshScope(memberID: "member-new")
        let refresher = RecordingCriticalDataRefresher()
        let useCase = ResolveCriticalDataFreshnessUseCase(
            remoteRepository: FixedCriticalDataFreshnessRemoteRepository(
                config: CriticalDataFreshnessConfig(
                    cacheExpirationMinutes: 15,
                    remoteTimestampsMillis: timestamps
                )
            ),
            localRepository: SeededCriticalDataFreshnessLocalRepository(
                metadata: criticalMetadata(
                    timestamps: timestamps,
                    scope: criticalRefreshScope(memberID: "member-old"),
                    validatedAtMillis: 5_000
                )
            ),
            refresher: refresher,
            nowProvider: { 6_000 }
        )

        _ = try await useCase.execute(scope: scope)

        #expect(await refresher.recordedCollections() == Set(CriticalCollection.allCases))
    }

    @Test func changedMemberVisibilityScopeForcesFullRefresh() async throws {
        let timestamps = criticalTimestamps(defaultValue: 1_000)
        let currentScope = criticalRefreshScope(canManageMembers: true)
        let refresher = RecordingCriticalDataRefresher()
        let useCase = ResolveCriticalDataFreshnessUseCase(
            remoteRepository: FixedCriticalDataFreshnessRemoteRepository(
                config: CriticalDataFreshnessConfig(
                    cacheExpirationMinutes: 15,
                    remoteTimestampsMillis: timestamps
                )
            ),
            localRepository: SeededCriticalDataFreshnessLocalRepository(
                metadata: criticalMetadata(
                    timestamps: timestamps,
                    scope: criticalRefreshScope(canManageMembers: false),
                    validatedAtMillis: 5_000
                )
            ),
            refresher: refresher,
            nowProvider: { 6_000 }
        )

        _ = try await useCase.execute(scope: currentScope)

        #expect(await refresher.recordedCollections() == Set(CriticalCollection.allCases))
    }

    @Test func partialRefreshFailureReturnsNoAcknowledgement() async {
        let originalTimestamps = criticalTimestamps(defaultValue: 1_000)
        var remoteTimestamps = originalTimestamps
        remoteTimestamps[.orders] = 2_000
        let scope = criticalRefreshScope()
        let localRepository = SeededCriticalDataFreshnessLocalRepository(
            metadata: criticalMetadata(
                timestamps: originalTimestamps,
                scope: scope,
                validatedAtMillis: 5_000
            )
        )
        let useCase = ResolveCriticalDataFreshnessUseCase(
            remoteRepository: FixedCriticalDataFreshnessRemoteRepository(
                config: CriticalDataFreshnessConfig(
                    cacheExpirationMinutes: 15,
                    remoteTimestampsMillis: remoteTimestamps
                )
            ),
            localRepository: localRepository,
            refresher: RecordingCriticalDataRefresher(fails: true),
            nowProvider: { 6_000 }
        )

        await #expect(throws: CriticalDataRefreshTestError.self) {
            _ = try await useCase.execute(scope: scope)
        }
        #expect(localRepository.getMetadata()?.acknowledgedTimestampsMillis == originalTimestamps)
    }

    @Test func currentTimestampsStillRefreshAncillaryOrderingDependencies() async throws {
        let timestamps = criticalTimestamps(defaultValue: 1_000)
        let scope = criticalRefreshScope()
        let selectedMember = member(id: scope.memberID, ecoCommitmentMode: .weekly)
        let payload = CriticalDataRefreshPayload(
            selectedMember: selectedMember,
            seasonalCommitments: []
        )
        let refresher = RecordingCriticalDataRefresher(payload: payload)
        let useCase = ResolveCriticalDataFreshnessUseCase(
            remoteRepository: FixedCriticalDataFreshnessRemoteRepository(
                config: CriticalDataFreshnessConfig(
                    cacheExpirationMinutes: 15,
                    remoteTimestampsMillis: timestamps
                )
            ),
            localRepository: SeededCriticalDataFreshnessLocalRepository(
                metadata: criticalMetadata(
                    timestamps: timestamps,
                    scope: scope,
                    validatedAtMillis: 5_000
                )
            ),
            refresher: refresher,
            nowProvider: { 6_000 }
        )

        let resolution = try await useCase.execute(scope: scope)

        #expect(await refresher.recordedCollections().isEmpty)
        #expect(
            resolution == .fresh(
                metadataToPersist: nil,
                refreshedPayload: payload
            )
        )
    }
}

private actor RecordingCriticalDataRefresher: CriticalDataRefreshing {
    private let fails: Bool
    private let payload: CriticalDataRefreshPayload
    private var collections: Set<CriticalCollection> = []

    init(fails: Bool = false, payload: CriticalDataRefreshPayload = CriticalDataRefreshPayload()) {
        self.fails = fails
        self.payload = payload
    }

    func refresh(
        collections: Set<CriticalCollection>,
        scope: CriticalDataRefreshScope
    ) async throws -> CriticalDataRefreshPayload {
        self.collections = collections
        if fails {
            throw CriticalDataRefreshTestError()
        }
        return payload
    }

    func recordedCollections() -> Set<CriticalCollection> {
        collections
    }
}

private struct CriticalDataRefreshTestError: Error {}

@MainActor
private final class SeededCriticalDataFreshnessLocalRepository: CriticalDataFreshnessLocalRepository {
    private var metadata: CriticalDataFreshnessMetadata?
    private(set) var writeGeneration: UInt64 = 0

    init(metadata: CriticalDataFreshnessMetadata?) {
        self.metadata = metadata
    }

    func getMetadata() -> CriticalDataFreshnessMetadata? {
        metadata
    }

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

private func criticalRefreshScope(
    principalUID: String = "uid-current",
    memberID: String = "member-current",
    environment: SessionEnvironment = .develop,
    canManageMembers: Bool = false
) -> CriticalDataRefreshScope {
    CriticalDataRefreshScope(
        principalUID: principalUID,
        memberID: memberID,
        environment: environment,
        canManageMembers: canManageMembers
    )
}

private func criticalTimestamps(defaultValue: Int64) -> [CriticalCollection: Int64] {
    Dictionary(uniqueKeysWithValues: CriticalCollection.allCases.map { ($0, defaultValue) })
}

private func criticalMetadata(
    timestamps: [CriticalCollection: Int64],
    scope: CriticalDataRefreshScope,
    validatedAtMillis: Int64
) -> CriticalDataFreshnessMetadata {
    CriticalDataFreshnessMetadata(
        validatedAtMillis: validatedAtMillis,
        acknowledgedTimestampsMillis: timestamps,
        environment: scope.environment,
        principalUID: scope.principalUID,
        memberID: scope.memberID,
        canManageMembers: scope.canManageMembers
    )
}
