import Foundation

nonisolated enum CriticalCollection: String, CaseIterable, Sendable {
    case users
    case products
    case orders
    case orderlines
    case containers
    case measures
}

nonisolated struct CriticalDataFreshnessConfig: Equatable {
    let cacheExpirationMinutes: Int
    let remoteTimestampsMillis: [CriticalCollection: Int64]
}

nonisolated struct CriticalDataFreshnessMetadata: Equatable {
    let validatedAtMillis: Int64
    let acknowledgedTimestampsMillis: [CriticalCollection: Int64]
    let environment: SessionEnvironment
    let principalUID: String
    private let storedAuthenticatedMemberID: String
    let memberID: String
    let canManageMembers: Bool

    var authenticatedMemberID: String { storedAuthenticatedMemberID }
}

extension CriticalDataFreshnessMetadata {
    init(
        validatedAtMillis: Int64,
        acknowledgedTimestampsMillis: [CriticalCollection: Int64],
        environment: SessionEnvironment,
        principalUID: String,
        authenticatedMemberID: String? = nil,
        memberID: String,
        canManageMembers: Bool = false
    ) {
        self.validatedAtMillis = validatedAtMillis
        self.acknowledgedTimestampsMillis = acknowledgedTimestampsMillis
        self.environment = environment
        self.principalUID = principalUID
        self.storedAuthenticatedMemberID = authenticatedMemberID ?? memberID
        self.memberID = memberID
        self.canManageMembers = canManageMembers
    }
}

nonisolated struct CriticalDataRefreshScope: Equatable {
    let principalUID: String
    private let storedAuthenticatedMemberID: String
    let memberID: String
    let environment: SessionEnvironment
    let canManageMembers: Bool

    var authenticatedMemberID: String { storedAuthenticatedMemberID }
}

extension CriticalDataRefreshScope {
    init(
        principalUID: String,
        authenticatedMemberID: String? = nil,
        memberID: String,
        environment: SessionEnvironment,
        canManageMembers: Bool
    ) {
        self.principalUID = principalUID
        self.storedAuthenticatedMemberID = authenticatedMemberID ?? memberID
        self.memberID = memberID
        self.environment = environment
        self.canManageMembers = canManageMembers
    }
}

nonisolated struct CriticalDataRefreshPayload: Equatable {
    private let storedAuthenticatedMember: Member?
    let selectedMember: Member?
    let members: [Member]?
    let products: [Product]?
    let seasonalCommitments: [SeasonalCommitment]?

    var authenticatedMember: Member? { storedAuthenticatedMember }
}

extension CriticalDataRefreshPayload {
    init(
        authenticatedMember: Member? = nil,
        selectedMember: Member? = nil,
        members: [Member]? = nil,
        products: [Product]? = nil,
        seasonalCommitments: [SeasonalCommitment]? = nil
    ) {
        self.storedAuthenticatedMember = authenticatedMember
        self.selectedMember = selectedMember
        self.members = members
        self.products = products
        self.seasonalCommitments = seasonalCommitments
    }
}

nonisolated enum CriticalDataFreshnessResolution: Equatable, Sendable {
    case fresh(
        metadataToPersist: CriticalDataFreshnessMetadata?,
        refreshedPayload: CriticalDataRefreshPayload
    )
    case invalidConfig
}

protocol CriticalDataFreshnessRemoteRepository: Sendable {
    func getConfig(environment: SessionEnvironment) async throws -> CriticalDataFreshnessConfig
}

protocol CriticalDataRefreshing: Sendable {
    func refresh(
        collections: Set<CriticalCollection>,
        scope: CriticalDataRefreshScope
    ) async throws -> CriticalDataRefreshPayload
}

struct NoOpCriticalDataRefresher: CriticalDataRefreshing {
    func refresh(
        collections: Set<CriticalCollection>,
        scope: CriticalDataRefreshScope
    ) async throws -> CriticalDataRefreshPayload {
        CriticalDataRefreshPayload()
    }
}

@MainActor
protocol CriticalDataFreshnessLocalRepository: Sendable {
    var writeGeneration: UInt64 { get }
    func getMetadata() -> CriticalDataFreshnessMetadata?
    func saveMetadata(_ metadata: CriticalDataFreshnessMetadata, ifWriteGeneration writeGeneration: UInt64) -> Bool
    func clear() throws
}

extension CriticalDataFreshnessLocalRepository {
    @discardableResult func saveMetadata(_ metadata: CriticalDataFreshnessMetadata) -> Bool {
        saveMetadata(metadata, ifWriteGeneration: writeGeneration)
    }
}
