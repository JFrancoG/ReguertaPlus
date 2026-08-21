import Foundation

nonisolated enum SessionEnvironment: String, Codable, Equatable, Sendable {
    case develop
    case production
}

nonisolated struct AuthorizedMemberResolution: Equatable {
    let memberId: String
    let roles: Set<MemberRole>
    let isActive: Bool
    let environment: SessionEnvironment
    let firstLoginLinked: Bool
}

nonisolated enum AuthorizedMemberResolutionError: Error, Equatable, Sendable {
    case unauthorized(UnauthorizedReason)
    case sessionExpired
}

nonisolated struct SessionEnvironmentLease: Equatable {
    private let id: UUID
}

extension SessionEnvironmentLease {
    init() {
        id = UUID()
    }
}

struct SessionEnvironmentSnapshot: Equatable {
    let environment: SessionEnvironment
}

protocol SessionEnvironmentSnapshotProviding: Sendable {
    func snapshot() -> SessionEnvironmentSnapshot
}

nonisolated protocol AuthorizedMemberResolving: Sendable {
    func resolve(
        authPrincipal: AuthPrincipal,
        requestedEnvironment: SessionEnvironment
    ) async throws -> AuthorizedMemberResolution
}

nonisolated struct SessionEnvironmentRoutingTransition: Equatable {
    let generation: UInt64
    let environment: SessionEnvironment
}

@MainActor
final class SessionEnvironmentRoutingSignal {
    private(set) var currentTransition: SessionEnvironmentRoutingTransition
    private var observers: [@MainActor @Sendable (SessionEnvironmentRoutingTransition) -> Void] = []

    init(environment: SessionEnvironment) {
        currentTransition = SessionEnvironmentRoutingTransition(
            generation: 0,
            environment: environment
        )
    }

    func observe(
        _ observer: @escaping @MainActor @Sendable (SessionEnvironmentRoutingTransition) -> Void
    ) {
        observers.append(observer)
    }

    func publish(environment: SessionEnvironment) {
        guard currentTransition.environment != environment else { return }
        currentTransition = SessionEnvironmentRoutingTransition(
            generation: currentTransition.generation &+ 1,
            environment: environment
        )
        let transition = currentTransition
        observers.forEach { $0(transition) }
    }
}

@MainActor
protocol SessionEnvironmentRouting: Sendable {
    var baseEnvironment: SessionEnvironment { get }
    var environmentSnapshotProvider: any SessionEnvironmentSnapshotProviding { get }
    var transitionSignal: SessionEnvironmentRoutingSignal { get }
    func applyResolvedEnvironment(_ environment: SessionEnvironment, lease: SessionEnvironmentLease)
    func resetToBaseEnvironment(ifOwnedBy lease: SessionEnvironmentLease)
    func resetToBaseEnvironment()
}
