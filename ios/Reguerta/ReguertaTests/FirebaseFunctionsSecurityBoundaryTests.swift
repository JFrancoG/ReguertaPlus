import FirebaseFirestore
import Foundation
import Testing

@testable import Reguerta

@MainActor
struct FirebaseFunctionsSecurityBoundaryTests {
    @Test
    func authenticatedClientPostsCodableBodyWithFreshBearerToken() async throws {
        let response = ResolveAuthorizedMemberResponse(
            authorized: true,
            memberId: "member_1",
            roles: [.member, .producer],
            isActive: true,
            environment: .production,
            firstLoginLinked: true
        )
        let loader = RecordingHTTPDataLoader(
            data: try JSONEncoder().encode(response),
            statusCode: 200
        )
        let tokenProvider = RecordingFirebaseIDTokenProvider(token: "fresh-token")
        let client = AuthenticatedFirebaseFunctionsClient(
            baseURL: URL(string: "https://europe-west1-example.cloudfunctions.net")!,
            tokenProvider: tokenProvider,
            dataLoader: loader,
            requestTimeout: 12
        )

        let decoded = try await client.post(
            function: .resolveAuthorizedMember,
            body: ResolveAuthorizedMemberRequest(env: .develop),
            response: ResolveAuthorizedMemberResponse.self
        )

        #expect(decoded == response)
        #expect(tokenProvider.forceRefreshValues == [true])
        let request = try #require(loader.lastRequest)
        #expect(request.httpMethod == "POST")
        #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer fresh-token")
        #expect(request.value(forHTTPHeaderField: "Content-Type") == "application/json")
        #expect(request.timeoutInterval == 12)
        #expect(request.url?.absoluteString == "https://europe-west1-example.cloudfunctions.net/resolveAuthorizedMember")
        let body = try #require(request.httpBody)
        #expect(try JSONDecoder().decode(ResolveAuthorizedMemberRequest.self, from: body) == .init(env: .develop))
    }

    @Test(arguments: [
        (401, FirebaseFunctionClientError.unauthorized(code: "unauthenticated", message: "Token required")),
        (403, FirebaseFunctionClientError.forbidden(code: "admin_required", message: "Admin required")),
        (409, FirebaseFunctionClientError.conflict(code: "last_active_admin", message: "Last admin"))
    ])
    func authenticatedClientMapsAuthorizationAndConflictFailures(
        statusCode: Int,
        expectedError: FirebaseFunctionClientError
    ) async throws {
        let payload: FirebaseFunctionErrorResponse
        switch statusCode {
        case 401:
            payload = .init(error: .init(code: "unauthenticated", message: "Token required"))
        case 403:
            payload = .init(error: .init(code: "admin_required", message: "Admin required"))
        default:
            payload = .init(error: .init(code: "last_active_admin", message: "Last admin"))
        }
        let client = AuthenticatedFirebaseFunctionsClient(
            baseURL: URL(string: "https://example.test")!,
            tokenProvider: RecordingFirebaseIDTokenProvider(token: "token"),
            dataLoader: RecordingHTTPDataLoader(
                data: try JSONEncoder().encode(payload),
                statusCode: statusCode
            )
        )

        await #expect(throws: expectedError) {
            try await client.post(
                function: .resolveAuthorizedMember,
                body: ResolveAuthorizedMemberRequest(env: .develop),
                response: ResolveAuthorizedMemberResponse.self
            )
        }
    }

    @Test(arguments: [
        (URLError(.timedOut) as any Error, FirebaseFunctionClientError.timeout),
        (CancellationError() as any Error, FirebaseFunctionClientError.cancelled)
    ])
    func authenticatedClientMapsTimeoutAndCancellation(
        transportError: any Error,
        expectedError: FirebaseFunctionClientError
    ) async {
        let client = AuthenticatedFirebaseFunctionsClient(
            baseURL: URL(string: "https://example.test")!,
            tokenProvider: RecordingFirebaseIDTokenProvider(token: "token"),
            dataLoader: RecordingHTTPDataLoader(error: transportError)
        )

        await #expect(throws: expectedError) {
            try await client.post(
                function: .resolveAuthorizedMember,
                body: ResolveAuthorizedMemberRequest(env: .develop),
                response: ResolveAuthorizedMemberResponse.self
            )
        }
    }

    @Test(arguments: [
        (CancellationError() as any Error, FirebaseFunctionClientError.cancelled),
        (URLError(.timedOut) as any Error, FirebaseFunctionClientError.timeout)
    ])
    func authenticatedClientMapsTokenRefreshCancellationAndTimeout(
        tokenError: any Error,
        expectedError: FirebaseFunctionClientError
    ) async {
        let client = AuthenticatedFirebaseFunctionsClient(
            baseURL: URL(string: "https://example.test")!,
            tokenProvider: ThrowingFirebaseIDTokenProvider(error: tokenError),
            dataLoader: RecordingHTTPDataLoader(data: Data(), statusCode: 200)
        )

        await #expect(throws: expectedError) {
            try await client.post(
                function: .resolveAuthorizedMember,
                body: ResolveAuthorizedMemberRequest(env: .develop),
                response: ResolveAuthorizedMemberResponse.self
            )
        }
    }

    @Test
    func authorizedSessionAppliesResolvedEnvironmentBeforeExactMemberRead() async throws {
        let member = Member(
            id: "member_1",
            displayName: "Member",
            normalizedEmail: "member@example.com",
            authUid: "auth_1",
            roles: [.member],
            isActive: true,
            producerCatalogEnabled: true
        )
        let router = RecordingSessionEnvironmentRouter(baseEnvironment: .develop)
        let repository = EnvironmentRecordingMemberRepository(member: member, router: router)
        let useCase = ResolveAuthorizedSessionUseCase(
            repository: repository,
            resolver: FixedAuthorizedMemberResolver(
                resolution: AuthorizedMemberResolution(
                    memberId: member.id,
                    roles: member.roles,
                    isActive: true,
                    environment: .production,
                    firstLoginLinked: false
                )
            ),
            environmentRouter: router
        )

        let result = try await useCase.execute(
            authPrincipal: AuthPrincipal(uid: "auth_1", email: "member@example.com")
        )

        #expect(result == .authorized(member))
        #expect(repository.environmentAtMemberRead == .production)
        #expect(repository.requestedMemberIds == [member.id])
    }

    @Test
    func authorizedSessionRollsBackResolvedEnvironmentWhenExactMemberReadFails() async throws {
        let router = RecordingSessionEnvironmentRouter(baseEnvironment: .develop)
        let repository = EnvironmentRecordingMemberRepository(member: nil, router: router)
        let useCase = ResolveAuthorizedSessionUseCase(
            repository: repository,
            resolver: FixedAuthorizedMemberResolver(
                resolution: AuthorizedMemberResolution(
                    memberId: "missing",
                    roles: [.member],
                    isActive: true,
                    environment: .production,
                    firstLoginLinked: false
                )
            ),
            environmentRouter: router
        )

        let result = try await useCase.execute(
            authPrincipal: AuthPrincipal(uid: "auth_1", email: "member@example.com")
        )

        #expect(result == .unauthorized(.userNotFoundInAuthorizedUsers))
        #expect(repository.environmentAtMemberRead == .production)
        #expect(router.appliedEnvironment == nil)
        #expect(router.resetCount == 1)
    }

    @Test
    func adminUpsertUsesBearerContractWithoutActorIdentityAndEncodesClears() async throws {
        let loader = RecordingHTTPDataLoader(
            data: try JSONEncoder().encode(
                TestUpsertMemberResponse(
                    ok: true,
                    memberId: "member_admin",
                    roles: [.member, .admin],
                    isActive: true,
                    environment: .develop
                )
            ),
            statusCode: 200
        )
        let client = AuthenticatedFirebaseFunctionsClient(
            baseURL: URL(string: "https://example.test")!,
            tokenProvider: RecordingFirebaseIDTokenProvider(token: "token"),
            dataLoader: loader
        )
        let useCase = UpsertMemberByAdminUseCase(
            repository: FirebaseMemberAdministrationRepository(
                client: client,
                environmentProvider: { .develop }
            )
        )
        let target = Member(
            id: "member_admin",
            displayName: "Admin",
            companyName: nil,
            phoneNumber: nil,
            normalizedEmail: " ADMIN@EXAMPLE.COM ",
            authUid: "must-not-be-sent",
            roles: [.admin],
            isActive: true,
            producerCatalogEnabled: true
        )

        let saved = try await useCase.execute(target: target)

        #expect(saved.roles == [.member, .admin])
        #expect(saved.normalizedEmail == "admin@example.com")
        let request = try #require(loader.lastRequest)
        let body = try #require(request.httpBody)
        let decoded = try JSONDecoder().decode(TestUpsertMemberRequest.self, from: body)
        #expect(decoded.environment == .develop)
        #expect(decoded.memberId == target.id)
        #expect(Set(decoded.roles) == [.member, .admin])
        let json = try #require(String(data: body, encoding: .utf8))
        #expect(json.contains("\"companyName\":null"))
        #expect(json.contains("\"phoneNumber\":null"))
        #expect(!json.contains("actorAuthUid"))
        #expect(!json.contains("\"authUid\""))
    }

    @Test
    func adminUpsertRejectsResponseFromDifferentEnvironment() async throws {
        let loader = RecordingHTTPDataLoader(
            data: try JSONEncoder().encode(
                TestUpsertMemberResponse(
                    ok: true,
                    memberId: "member_admin",
                    roles: [.member, .admin],
                    isActive: true,
                    environment: .production
                )
            ),
            statusCode: 200
        )
        let useCase = UpsertMemberByAdminUseCase(
            repository: FirebaseMemberAdministrationRepository(
                client: AuthenticatedFirebaseFunctionsClient(
                    baseURL: URL(string: "https://example.test")!,
                    tokenProvider: RecordingFirebaseIDTokenProvider(token: "token"),
                    dataLoader: loader
                ),
                environmentProvider: { .develop }
            )
        )
        let target = Member(
            id: "member_admin",
            displayName: "Admin",
            normalizedEmail: "admin@example.com",
            authUid: nil,
            roles: [.admin],
            isActive: true,
            producerCatalogEnabled: true
        )

        await #expect(throws: FirebaseFunctionClientError.invalidResponse) {
            try await useCase.execute(target: target)
        }
    }

    @Test
    func shiftSwapRejectsMismatchedBackendAction() async throws {
        let loader = RecordingHTTPDataLoader(
            data: try JSONEncoder().encode(
                TestShiftSwapTransitionResponse(
                    ok: true,
                    environment: .develop,
                    action: "cancel",
                    requestId: "swap_1",
                    candidateCount: 1
                )
            ),
            statusCode: 200
        )
        let repository = FirestoreShiftSwapRequestRepository(
            db: Firestore.firestore(),
            environment: .develop,
            functionsClient: AuthenticatedFirebaseFunctionsClient(
                baseURL: URL(string: "https://example.test")!,
                tokenProvider: RecordingFirebaseIDTokenProvider(token: "token"),
                dataLoader: loader
            )
        )
        let request = ShiftSwapRequest(
            id: "",
            requestedShiftId: "shift_1",
            requesterUserId: "member_1",
            reason: "reason",
            status: .open,
            candidates: [],
            responses: [],
            selectedCandidateUserId: nil,
            selectedCandidateShiftId: nil,
            requestedAtMillis: 1,
            confirmedAtMillis: nil,
            appliedAtMillis: nil
        )

        await #expect(throws: FirebaseFunctionClientError.invalidResponse) {
            try await repository.transition(.create(request: request))
        }
    }

    @Test
    func publicMemberDirectoryMappingDropsSensitiveIdentityFields() throws {
        let member = try #require(
            FirestoreMemberRepository.mapDirectoryMember(
                id: "producer_1",
                data: [
                    "displayName": "Producer",
                    "companyName": "Farm",
                    "roles": ["producer"],
                    "isActive": true,
                    "producerCatalogEnabled": false,
                    "isCommonPurchaseManager": true,
                    "producerParity": "odd",
                    "ecoCommitment": ["mode": "biweekly", "parity": "even"],
                    "normalizedEmail": "must-not-leak@example.com",
                    "phoneNumber": "600000000",
                    "authUid": "must-not-leak"
                ]
            )
        )

        #expect(member.normalizedEmail.isEmpty)
        #expect(member.phoneNumber == nil)
        #expect(member.authUid == nil)
        #expect(member.roles == [.member, .producer])
        #expect(member.ecoCommitmentMode == .biweekly)
        #expect(member.ecoCommitmentParity == .even)
    }

    @Test
    func publicDirectoryListPreservesAuthenticatedMembersFullIdentity() throws {
        let authenticatedMember = Member(
            id: "member_1",
            displayName: "Own profile",
            phoneNumber: "600000000",
            normalizedEmail: "own@example.com",
            authUid: "auth_1",
            roles: [.member],
            isActive: true,
            producerCatalogEnabled: true
        )
        let sanitizedSelf = try #require(
            FirestoreMemberRepository.mapDirectoryMember(
                id: authenticatedMember.id,
                data: ["displayName": "Own profile", "roles": ["member"], "isActive": true]
            )
        )
        let sanitizedOther = try #require(
            FirestoreMemberRepository.mapDirectoryMember(
                id: "member_2",
                data: ["displayName": "Other", "roles": ["member"], "isActive": true]
            )
        )

        let merged = FirestoreMemberRepository.mergingAuthenticatedMember(
            authenticatedMember,
            into: [sanitizedSelf, sanitizedOther]
        )

        #expect(merged.count == 2)
        #expect(merged.first { $0.id == authenticatedMember.id }?.normalizedEmail == "own@example.com")
        #expect(merged.first { $0.id == authenticatedMember.id }?.authUid == "auth_1")
        #expect(merged.first { $0.id == "member_2" }?.normalizedEmail.isEmpty == true)
    }
}

nonisolated private struct FixedAuthorizedMemberResolver: AuthorizedMemberResolving {
    let resolution: AuthorizedMemberResolution

    func resolve(
        authPrincipal _: AuthPrincipal,
        requestedEnvironment _: SessionEnvironment
    ) async throws -> AuthorizedMemberResolution {
        resolution
    }
}

@MainActor
private final class RecordingSessionEnvironmentRouter: SessionEnvironmentRouting {
    let baseEnvironment: SessionEnvironment
    private(set) var appliedEnvironment: SessionEnvironment?
    private(set) var resetCount = 0

    init(baseEnvironment: SessionEnvironment) {
        self.baseEnvironment = baseEnvironment
    }

    func applyResolvedEnvironment(_ environment: SessionEnvironment) {
        appliedEnvironment = environment
    }

    func resetToBaseEnvironment() {
        appliedEnvironment = nil
        resetCount += 1
    }
}

@MainActor
private final class EnvironmentRecordingMemberRepository: MemberRepository {
    let memberValue: Member?
    let router: RecordingSessionEnvironmentRouter
    private(set) var environmentAtMemberRead: SessionEnvironment?
    private(set) var requestedMemberIds: [String] = []

    init(member: Member?, router: RecordingSessionEnvironmentRouter) {
        memberValue = member
        self.router = router
    }

    func member(id: String) async throws -> Member? {
        requestedMemberIds.append(id)
        environmentAtMemberRead = router.appliedEnvironment
        return id == memberValue?.id ? memberValue : nil
    }

    func members(visibleTo member: Member) async throws -> [Member] {
        memberValue.map { [$0] } ?? []
    }

    func updateOwnProducerCatalogEnabled(memberId: String, enabled: Bool) async throws -> Member {
        guard let memberValue else {
            throw FirebaseFunctionClientError.invalidResponse
        }
        return memberValue
    }
}

nonisolated private struct TestUpsertMemberResponse: Encodable {
    let ok: Bool
    let memberId: String
    let roles: [MemberRole]
    let isActive: Bool
    let environment: SessionEnvironment
}

nonisolated private struct TestUpsertMemberRequest: Decodable {
    let environment: SessionEnvironment
    let memberId: String
    let normalizedEmail: String
    let roles: [MemberRole]
}

nonisolated private struct TestShiftSwapTransitionResponse: Encodable {
    let ok: Bool
    let environment: SessionEnvironment
    let action: String
    let requestId: String
    let candidateCount: Int?
}

@MainActor
private final class RecordingFirebaseIDTokenProvider: FirebaseIDTokenProviding {
    let token: String
    private(set) var forceRefreshValues: [Bool] = []

    init(token: String) {
        self.token = token
    }

    func validIDToken(forcingRefresh: Bool) async throws -> String {
        forceRefreshValues.append(forcingRefresh)
        return token
    }
}

@MainActor
private struct ThrowingFirebaseIDTokenProvider: FirebaseIDTokenProviding {
    let error: any Error

    func validIDToken(forcingRefresh: Bool) async throws -> String {
        throw error
    }
}

@MainActor
private final class RecordingHTTPDataLoader: HTTPDataLoading {
    private let result: Result<(Data, URLResponse), any Error>
    private(set) var lastRequest: URLRequest?

    init(data: Data, statusCode: Int) {
        let response = HTTPURLResponse(
            url: URL(string: "https://example.test")!,
            statusCode: statusCode,
            httpVersion: nil,
            headerFields: ["Content-Type": "application/json"]
        )!
        result = .success((data, response))
    }

    init(error: any Error) {
        result = .failure(error)
    }

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        lastRequest = request
        return try result.get()
    }
}
