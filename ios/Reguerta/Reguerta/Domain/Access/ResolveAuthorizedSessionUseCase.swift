import Foundation

struct ResolveAuthorizedSessionUseCase {
    private let storedRepository: any MemberRepository
    private let storedResolver: any AuthorizedMemberResolving

    /// Resolves and verifies the member represented by an authenticated principal.
    ///
    /// Resolution starts from the immutable environment snapshot supplied by the session owner
    /// before its first suspension. The resolver receives that exact snapshot, while the member
    /// is read from the resolved candidate environment without publishing the candidate as live
    /// routing. The session owner may commit the route only after mandatory hydration is complete
    /// and the operation is still current.
    ///
    /// Authorization failures are returned as `.unauthorized`, while an expired backend session
    /// is returned as `.sessionExpired`. Cancellation and non-authorization failures from the
    /// resolver or member repository are propagated to the caller.
    ///
    /// - Parameter authPrincipal: The Firebase-authenticated identity to resolve.
    /// - Parameter requestedEnvironment: The base-environment snapshot captured by the session
    ///   owner before awaiting authorization resolution.
    /// - Returns: An authorized member and environment, a domain authorization failure, or an
    ///   expired-session outcome.
    /// - Throws: `CancellationError`, a non-authorization resolver error, or an error produced
    ///   while loading the resolved member.
    func execute(
        authPrincipal: AuthPrincipal,
        requestedEnvironment: SessionEnvironment
    ) async throws -> AccessResolutionResult {
        try Task.checkCancellation()
        let resolution: AuthorizedMemberResolution
        do {
            resolution = try await storedResolver.resolve(
                authPrincipal: authPrincipal,
                requestedEnvironment: requestedEnvironment
            )
        } catch let error as AuthorizedMemberResolutionError {
            try Task.checkCancellation()
            switch error {
            case .unauthorized(let reason):
                return .unauthorized(reason)
            case .sessionExpired:
                return .sessionExpired
            }
        }
        try Task.checkCancellation()
        guard resolution.isActive else {
            return .unauthorized(.userAccessRestricted)
        }
        let resolvedMember = try await storedRepository.member(
            id: resolution.memberId,
            environment: resolution.environment
        )
        try Task.checkCancellation()
        guard let member = resolvedMember else {
            return .unauthorized(.userNotFoundInAuthorizedUsers)
        }
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
    init(repository: any MemberRepository, resolver: any AuthorizedMemberResolving) {
        self.storedRepository = repository
        self.storedResolver = resolver
    }
}
