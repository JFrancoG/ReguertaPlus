import Foundation

nonisolated struct ResolveAuthorizedMemberRequest: Codable, Equatable, Sendable {
    let env: SessionEnvironment
}

nonisolated struct ResolveAuthorizedMemberResponse: Codable, Equatable, Sendable {
    let authorized: Bool
    let memberId: String
    let roles: Set<MemberRole>
    let isActive: Bool
    let environment: SessionEnvironment
    let firstLoginLinked: Bool
}

@MainActor
struct FirebaseAuthorizedMemberResolver: AuthorizedMemberResolving {
    private let client: AuthenticatedFirebaseFunctionsClient

    init(client: AuthenticatedFirebaseFunctionsClient) {
        self.client = client
    }

    func resolve(
        authPrincipal _: AuthPrincipal,
        requestedEnvironment: SessionEnvironment
    ) async throws -> AuthorizedMemberResolution {
        do {
            let response = try await client.post(
                function: .resolveAuthorizedMember,
                body: ResolveAuthorizedMemberRequest(env: requestedEnvironment),
                response: ResolveAuthorizedMemberResponse.self
            )
            guard response.authorized else {
                throw AuthorizedMemberResolutionError.unauthorized(.userAccessRestricted)
            }
            return AuthorizedMemberResolution(
                memberId: response.memberId,
                roles: response.roles,
                isActive: response.isActive,
                environment: response.environment,
                firstLoginLinked: response.firstLoginLinked
            )
        } catch let error as FirebaseFunctionClientError {
            guard case .forbidden(let code, _) = error else {
                throw error
            }
            switch code {
            case "member_not_found", "unlinked_account":
                throw AuthorizedMemberResolutionError.unauthorized(.userNotFoundInAuthorizedUsers)
            case "verified_email_required":
                throw AuthorizedMemberResolutionError.unauthorized(.emailVerificationRequired)
            default:
                throw AuthorizedMemberResolutionError.unauthorized(.userAccessRestricted)
            }
        }
    }
}
