import Foundation
import Testing

@testable import Reguerta

@MainActor
struct AuthorizedSessionErrorBoundaryTests {
    @Test func resolverMapsUnauthorizedFunctionResponseToExpiredDomainSession() async throws {
        let payload = FirebaseFunctionErrorResponse(
            error: FirebaseFunctionErrorPayload(
                code: "unauthenticated",
                message: "Token required"
            )
        )
        let resolver = FirebaseAuthorizedMemberResolver(
            client: AuthenticatedFirebaseFunctionsClient(
                baseURL: URL(string: "https://example.test")!,
                tokenProvider: RecordingFirebaseIDTokenProvider(token: "token"),
                dataLoader: RecordingHTTPDataLoader(
                    data: try JSONEncoder().encode(payload),
                    statusCode: 401
                )
            )
        )

        await #expect(throws: AuthorizedMemberResolutionError.sessionExpired) {
            try await resolver.resolve(
                authPrincipal: AuthPrincipal(uid: "auth_1", email: "member@example.com"),
                requestedEnvironment: .develop
            )
        }
    }

    @Test func useCaseMapsExpiredResolverToDomainOutcome() async throws {
        let router = RecordingSessionEnvironmentRouter(baseEnvironment: .develop)
        let useCase = ResolveAuthorizedSessionUseCase(
            repository: EnvironmentRecordingMemberRepository(member: nil, router: router),
            resolver: SecurityBoundaryThrowingAuthorizedMemberResolver(error: .sessionExpired)
        )

        let result = try await useCase.execute(
            authPrincipal: AuthPrincipal(uid: "auth_1", email: "member@example.com"),
            requestedEnvironment: router.baseEnvironment
        )

        #expect(result == .sessionExpired)
        #expect(router.appliedEnvironment == nil)
        #expect(router.resetCount == 0)
    }

    @Test func cancellationAfterResolverReturnWinsOverExpiredDomainOutcome() async {
        let router = RecordingSessionEnvironmentRouter(baseEnvironment: .develop)
        let useCase = ResolveAuthorizedSessionUseCase(
            repository: EnvironmentRecordingMemberRepository(member: nil, router: router),
            resolver: CancellingExpiredMemberResolver()
        )
        let operation = Task {
            try await useCase.execute(
                authPrincipal: AuthPrincipal(uid: "auth_1", email: "member@example.com"),
                requestedEnvironment: router.baseEnvironment
            )
        }

        await #expect(throws: CancellationError.self) {
            try await operation.value
        }
        #expect(router.appliedEnvironment == nil)
        #expect(router.resetCount == 0)
    }

    @Test(arguments: [
        ("member_not_found", UnauthorizedReason.userNotFoundInAuthorizedUsers),
        ("verified_email_required", UnauthorizedReason.emailVerificationRequired),
        ("unknown_forbidden", UnauthorizedReason.userAccessRestricted)
    ])
    func resolverPreservesForbiddenAuthorizationReasons(
        code: String,
        expectedReason: UnauthorizedReason
    ) async throws {
        let payload = FirebaseFunctionErrorResponse(
            error: FirebaseFunctionErrorPayload(code: code, message: "Forbidden")
        )
        let resolver = FirebaseAuthorizedMemberResolver(
            client: AuthenticatedFirebaseFunctionsClient(
                baseURL: URL(string: "https://example.test")!,
                tokenProvider: RecordingFirebaseIDTokenProvider(token: "token"),
                dataLoader: RecordingHTTPDataLoader(
                    data: try JSONEncoder().encode(payload),
                    statusCode: 403
                )
            )
        )

        await #expect(throws: AuthorizedMemberResolutionError.unauthorized(expectedReason)) {
            try await resolver.resolve(
                authPrincipal: AuthPrincipal(uid: "auth_1", email: "member@example.com"),
                requestedEnvironment: .develop
            )
        }
    }

    @Test func resolverDoesNotReinterpretTransportFailureAsSessionExpiration() async {
        let resolver = FirebaseAuthorizedMemberResolver(
            client: AuthenticatedFirebaseFunctionsClient(
                baseURL: URL(string: "https://example.test")!,
                tokenProvider: RecordingFirebaseIDTokenProvider(token: "token"),
                dataLoader: RecordingHTTPDataLoader(error: URLError(.timedOut))
            )
        )

        await #expect(throws: FirebaseFunctionClientError.timeout) {
            try await resolver.resolve(
                authPrincipal: AuthPrincipal(uid: "auth_1", email: "member@example.com"),
                requestedEnvironment: .develop
            )
        }
    }
}
