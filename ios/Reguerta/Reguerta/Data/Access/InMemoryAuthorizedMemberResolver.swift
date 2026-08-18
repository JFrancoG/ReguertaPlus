import Foundation

struct InMemoryAuthorizedMemberResolver: AuthorizedMemberResolving {
    private let storedRepository: any LocalMemberRepository

    func resolve(
        authPrincipal: AuthPrincipal,
        requestedEnvironment: SessionEnvironment
    ) async throws -> AuthorizedMemberResolution {
        if let linked = await storedRepository.findByAuthUid(authPrincipal.uid) {
            return resolution(for: linked, environment: requestedEnvironment, firstLoginLinked: false)
        }
        let email = authPrincipal.email
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        guard let candidate = await storedRepository.findByEmailNormalized(email) else {
            throw AuthorizedMemberResolutionError.unauthorized(.userNotFoundInAuthorizedUsers)
        }
        guard candidate.isActive else {
            throw AuthorizedMemberResolutionError.unauthorized(.userAccessRestricted)
        }
        guard candidate.authUid == nil || candidate.authUid == authPrincipal.uid,
              let linked = await storedRepository.linkAuthUid(memberId: candidate.id, authUid: authPrincipal.uid) else {
            throw AuthorizedMemberResolutionError.unauthorized(.userAccessRestricted)
        }
        return resolution(for: linked, environment: requestedEnvironment, firstLoginLinked: candidate.authUid == nil)
    }

    private func resolution(
        for member: Member,
        environment: SessionEnvironment,
        firstLoginLinked: Bool
    ) -> AuthorizedMemberResolution {
        AuthorizedMemberResolution(
            memberId: member.id,
            roles: member.roles,
            isActive: member.isActive,
            environment: environment,
            firstLoginLinked: firstLoginLinked
        )
    }
}

extension InMemoryAuthorizedMemberResolver {
    init(repository: any LocalMemberRepository) {
        self.storedRepository = repository
    }
}
