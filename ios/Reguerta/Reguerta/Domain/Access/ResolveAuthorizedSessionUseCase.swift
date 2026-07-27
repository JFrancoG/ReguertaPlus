import Foundation

struct ResolveAuthorizedSessionUseCase: Sendable {
    private let repository: any MemberRepository
    private let resolver: any AuthorizedMemberResolving
    private let environmentRouter: any SessionEnvironmentRouting

    init(
        repository: any MemberRepository,
        resolver: any AuthorizedMemberResolving,
        environmentRouter: any SessionEnvironmentRouting
    ) {
        self.repository = repository
        self.resolver = resolver
        self.environmentRouter = environmentRouter
    }

    func execute(authPrincipal: AuthPrincipal) async throws -> AccessResolutionResult {
        let resolution: AuthorizedMemberResolution
        do {
            resolution = try await resolver.resolve(
                authPrincipal: authPrincipal,
                requestedEnvironment: environmentRouter.baseEnvironment
            )
        } catch let error as AuthorizedMemberResolutionError {
            switch error {
            case .unauthorized(let reason):
                return .unauthorized(reason)
            }
        }
        guard resolution.isActive else {
            return .unauthorized(.userAccessRestricted)
        }
        environmentRouter.applyResolvedEnvironment(resolution.environment)
        var keepsResolvedEnvironment = false
        defer {
            if !keepsResolvedEnvironment {
                environmentRouter.resetToBaseEnvironment()
            }
        }

        guard let member = try await repository.member(id: resolution.memberId) else {
            return .unauthorized(.userNotFoundInAuthorizedUsers)
        }
        guard member.isActive,
              member.id == resolution.memberId,
              member.authUid == authPrincipal.uid,
              member.roles == resolution.roles else {
            return .unauthorized(.userAccessRestricted)
        }
        keepsResolvedEnvironment = true
        return .authorized(member)
    }
}
