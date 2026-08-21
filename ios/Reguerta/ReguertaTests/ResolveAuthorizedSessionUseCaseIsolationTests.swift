import Testing

@testable import Reguerta

@Suite(.timeLimit(.minutes(1)))
struct ResolveAuthorizedSessionUseCaseIsolationTests {
    @Test func callerEnvironmentSnapshotIsForwardedExactlyWithoutRouterDependency() async throws {
        let principal = AuthPrincipal(uid: "auth_1", email: "member@example.com")
        let member = Member(
            id: "member_1",
            displayName: "Member",
            normalizedEmail: principal.email,
            authUid: principal.uid,
            roles: [.member],
            isActive: true,
            producerCatalogEnabled: true
        )
        let repository = InMemoryMemberRepository(items: [member])
        let useCase = ResolveAuthorizedSessionUseCase(
            repository: repository,
            resolver: ExactEnvironmentAuthorizedMemberResolver(
                expectedEnvironment: .production,
                resolution: AuthorizedMemberResolution(
                    memberId: member.id,
                    roles: member.roles,
                    isActive: member.isActive,
                    environment: .production,
                    firstLoginLinked: false
                )
            )
        )

        let result = try await useCase.execute(
            authPrincipal: principal,
            requestedEnvironment: .production
        )

        #expect(result == .authorized(member: member, environment: .production))
    }

    @Test func cancellationWinsWhenMemberLookupReturnsNilAfterIgnoringCancellation() async {
        let principal = AuthPrincipal(uid: "auth_1", email: "member@example.com")
        let repository = ControlledNilMemberRepository()
        let useCase = ResolveAuthorizedSessionUseCase(
            repository: repository,
            resolver: ExactEnvironmentAuthorizedMemberResolver(
                expectedEnvironment: .production,
                resolution: AuthorizedMemberResolution(
                    memberId: "member_1",
                    roles: [.member],
                    isActive: true,
                    environment: .production,
                    firstLoginLinked: false
                )
            )
        )

        let task = Task {
            try await useCase.execute(
                authPrincipal: principal,
                requestedEnvironment: .production
            )
        }

        await repository.waitForMemberRequest()
        task.cancel()
        await repository.resolveMemberRequestWithNil()

        await #expect(throws: CancellationError.self) {
            try await task.value
        }
    }
}

private actor ControlledNilMemberRepository: MemberRepository {
    private var memberRequestContinuation: CheckedContinuation<Member?, Never>?
    private var memberRequestWaiter: CheckedContinuation<Void, Never>?
    private var hasMemberRequest = false

    func member(id _: String, environment _: SessionEnvironment) async throws -> Member? {
        await withCheckedContinuation { continuation in
            memberRequestContinuation = continuation
            hasMemberRequest = true
            memberRequestWaiter?.resume()
            memberRequestWaiter = nil
        }
    }

    func members(visibleTo _: Member, environment _: SessionEnvironment) async throws -> [Member] {
        []
    }

    func updateOwnProducerCatalogEnabled(
        member: Member,
        enabled _: Bool,
        environment _: SessionEnvironment
    ) async throws -> Member {
        member
    }

    func waitForMemberRequest() async {
        guard !hasMemberRequest else { return }
        await withCheckedContinuation { continuation in
            memberRequestWaiter = continuation
        }
    }

    func resolveMemberRequestWithNil() {
        memberRequestContinuation?.resume(returning: nil)
        memberRequestContinuation = nil
    }
}

private struct ExactEnvironmentAuthorizedMemberResolver: AuthorizedMemberResolving {
    let expectedEnvironment: SessionEnvironment
    let resolution: AuthorizedMemberResolution

    func resolve(
        authPrincipal _: AuthPrincipal,
        requestedEnvironment: SessionEnvironment
    ) async throws -> AuthorizedMemberResolution {
        guard requestedEnvironment == expectedEnvironment else {
            throw ExactEnvironmentResolverError.unexpectedEnvironment(requestedEnvironment)
        }
        return resolution
    }
}

private enum ExactEnvironmentResolverError: Error {
    case unexpectedEnvironment(SessionEnvironment)
}
