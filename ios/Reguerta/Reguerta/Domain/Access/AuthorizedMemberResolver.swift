import Foundation

nonisolated enum SessionEnvironment: String, Codable, Equatable, Sendable {
    case develop
    case production
}

nonisolated struct AuthorizedMemberResolution: Equatable, Sendable {
    let memberId: String
    let roles: Set<MemberRole>
    let isActive: Bool
    let environment: SessionEnvironment
    let firstLoginLinked: Bool
}

nonisolated enum AuthorizedMemberResolutionError: Error, Equatable, Sendable {
    case unauthorized(UnauthorizedReason)
}

nonisolated struct SessionEnvironmentLease: Equatable, Sendable {
    private let id: UUID
}

extension SessionEnvironmentLease {
    init() {
        id = UUID()
    }
}

nonisolated protocol AuthorizedMemberResolving: Sendable {
    func resolve(
        authPrincipal: AuthPrincipal,
        requestedEnvironment: SessionEnvironment
    ) async throws -> AuthorizedMemberResolution
}

@MainActor
protocol SessionEnvironmentRouting: Sendable {
    var baseEnvironment: SessionEnvironment { get }
    func applyResolvedEnvironment(_ environment: SessionEnvironment, lease: SessionEnvironmentLease)
    func resetToBaseEnvironment(ifOwnedBy lease: SessionEnvironmentLease)
    func resetToBaseEnvironment()
}
