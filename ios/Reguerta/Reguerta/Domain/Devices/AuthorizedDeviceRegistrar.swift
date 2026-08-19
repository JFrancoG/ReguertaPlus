import Foundation

nonisolated struct AuthorizedDeviceSessionLease: Codable, Equatable {
    let id: UUID
}

extension AuthorizedDeviceSessionLease {
    init() {
        id = UUID()
    }
}

nonisolated struct AuthorizedDeviceRegistrationCommand: Equatable {
    let memberId: String
    let authUid: String
    let environment: SessionEnvironment
    let lease: AuthorizedDeviceSessionLease
}

nonisolated enum AuthorizedDeviceRegistrationResult: Equatable, Sendable {
    case registered
    case skipped
    case failed
}

protocol AuthorizedDeviceRegistrar: Sendable {
    func register(
        command: AuthorizedDeviceRegistrationCommand,
        isSessionCurrent: @escaping @MainActor @Sendable () -> Bool
    ) async throws -> AuthorizedDeviceRegistrationResult

    func updateRegistrationToken(_ token: String?) async throws

    func clearAuthorization(ifOwnedBy lease: AuthorizedDeviceSessionLease) async throws
}
