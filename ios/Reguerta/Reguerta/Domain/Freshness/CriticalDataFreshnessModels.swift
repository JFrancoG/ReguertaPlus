import Foundation

enum CriticalCollection: String, CaseIterable, Sendable {
    case users
    case products
    case orders
    case orderlines
    case containers
    case measures
}

struct CriticalDataFreshnessConfig: Equatable, Sendable {
    let cacheExpirationMinutes: Int
    let remoteTimestampsMillis: [CriticalCollection: Int64]
}

struct CriticalDataFreshnessMetadata: Equatable, Sendable {
    let validatedAtMillis: Int64
    let acknowledgedTimestampsMillis: [CriticalCollection: Int64]
}

enum CriticalDataFreshnessResolution: Equatable, Sendable {
    case fresh
    case invalidConfig
}

protocol CriticalDataFreshnessRemoteRepository: Sendable {
    func getConfig() async -> CriticalDataFreshnessConfig?
}

protocol CriticalDataFreshnessLocalRepository: Sendable {
    func getMetadata() async -> CriticalDataFreshnessMetadata?
    func saveMetadata(_ metadata: CriticalDataFreshnessMetadata) async
    func clear() async
}
