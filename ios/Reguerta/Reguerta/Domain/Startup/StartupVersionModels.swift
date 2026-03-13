import Foundation

enum StartupPlatform: String, Sendable {
    case android
    case ios
}

struct StartupVersionPolicy: Equatable, Sendable {
    let currentVersion: String
    let minimumVersion: String
    let forceUpdate: Bool
    let storeURL: String
}

enum StartupVersionGateDecision: Equatable, Sendable {
    case allow
    case optionalUpdate(storeURL: String)
    case forcedUpdate(storeURL: String)
}

protocol StartupVersionPolicyRepository: Sendable {
    func policy(for platform: StartupPlatform) async -> StartupVersionPolicy?
}
