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
    /// Establishes one authorized-device context while the supplied session fence remains current.
    ///
    /// Callers must retain at most one in-flight registration for an equivalent command and lease. A benign session
    /// refresh reuses that owner instead of overlapping the same persisted context. The registrar may retain the fence
    /// after this call returns so later token updates remain bound to the exact authorization that created the context.
    func register(
        command: AuthorizedDeviceRegistrationCommand,
        isSessionCurrent: @escaping @MainActor @Sendable () -> Bool
    ) async throws -> AuthorizedDeviceRegistrationResult

    func updateRegistrationToken(_ token: String?) async throws

    func clearAuthorization(ifOwnedBy lease: AuthorizedDeviceSessionLease) async throws
}
