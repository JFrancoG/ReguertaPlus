import Foundation

struct ResolveAuthorizedSessionUseCase {
    private let storedRepository: any MemberRepository
    private let storedResolver: any AuthorizedMemberResolving
    private let storedEnvironmentRouter: any SessionEnvironmentRouting

    /// Resolves and verifies the member represented by an authenticated principal.
    ///
    /// Resolution starts in the router's base environment. The exact member is read from the
    /// resolved candidate environment without publishing that candidate as live routing. The
    /// session owner may commit the route only after mandatory hydration is complete and the
    /// operation is still current.
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
        guard let member = try await storedRepository.member(
            id: resolution.memberId,
            environment: resolution.environment
        ) else {
            return .unauthorized(.userNotFoundInAuthorizedUsers)
        }
        try Task.checkCancellation()
        guard member.isActive,
              member.id == resolution.memberId,
              member.authUid == authPrincipal.uid,
              member.roles == resolution.roles else {
            return .unauthorized(.userAccessRestricted)
        }
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
