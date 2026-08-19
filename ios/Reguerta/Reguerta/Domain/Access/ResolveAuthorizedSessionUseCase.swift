import Foundation

struct ResolveAuthorizedSessionUseCase {
    private let storedRepository: any MemberRepository
    private let storedResolver: any AuthorizedMemberResolving
    private let storedEnvironmentRouter: any SessionEnvironmentRouting

    /// Resolves and verifies the member represented by an authenticated principal.
    ///
    /// Resolution starts in the router's base environment. A successful backend resolution
    /// receives a temporary environment lease so the local member is read from the resolved
    /// environment. The lease is rolled back unless the member identity, Firebase UID, active
    /// state, and canonical roles all match the server-owned resolution.
    ///
    /// Authorization failures are returned as `.unauthorized`; cancellation and non-authorization
    /// failures from the resolver or member repository are propagated to the caller.
    ///
    /// - Parameter authPrincipal: The Firebase-authenticated identity to resolve.
    /// - Returns: An authorized member and environment, or a domain authorization failure.
    /// - Throws: `CancellationError`, a non-authorization resolver error, or an error produced
    ///   while loading the resolved member.
    @MainActor
    func execute(authPrincipal: AuthPrincipal) async throws -> AccessResolutionResult {
        try Task.checkCancellation()
        let resolution: AuthorizedMemberResolution
        do {
            resolution = try await storedResolver.resolve(
                authPrincipal: authPrincipal,
                requestedEnvironment: storedEnvironmentRouter.baseEnvironment
            )
        } catch let error as AuthorizedMemberResolutionError {
            switch error {
            case .unauthorized(let reason):
                return .unauthorized(reason)
            }
        }
        try Task.checkCancellation()
        guard resolution.isActive else {
            return .unauthorized(.userAccessRestricted)
        }
        let environmentLease = SessionEnvironmentLease()
        storedEnvironmentRouter.applyResolvedEnvironment(
            resolution.environment,
            lease: environmentLease
        )
        var keepsResolvedEnvironment = false
        defer {
            if !keepsResolvedEnvironment {
                storedEnvironmentRouter.resetToBaseEnvironment(ifOwnedBy: environmentLease)
            }
        }

        guard let member = try await storedRepository.member(id: resolution.memberId) else {
            return .unauthorized(.userNotFoundInAuthorizedUsers)
        }
        try Task.checkCancellation()
        guard member.isActive,
              member.id == resolution.memberId,
              member.authUid == authPrincipal.uid,
              member.roles == resolution.roles else {
            return .unauthorized(.userAccessRestricted)
        }
        keepsResolvedEnvironment = true
        return .authorized(member: member, environment: resolution.environment)
    }
}

extension ResolveAuthorizedSessionUseCase {
    init(
        repository: any MemberRepository,
        resolver: any AuthorizedMemberResolving,
        environmentRouter: any SessionEnvironmentRouting
    ) {
        self.storedRepository = repository
        self.storedResolver = resolver
        self.storedEnvironmentRouter = environmentRouter
    }
}
