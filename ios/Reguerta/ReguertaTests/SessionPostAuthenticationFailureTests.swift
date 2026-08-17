import Testing

@testable import Reguerta

@MainActor
struct SessionPostAuthenticationFailureTests {
    @Test("Un fallo del resolver después de Auth termina la sesión")
    func resolverFailureTerminatesAuthenticatedSession() async {
        let member = postAuthenticationMember()
        let provider = ControlledSessionAuthProvider(
            signInResult: .success(postAuthenticationPrincipal(for: member))
        )
        let viewModel = makePostAuthenticationViewModel(
            member: member,
            provider: provider,
            resolver: FailingPostAuthenticationResolver()
        )

        guard let operation = startPostAuthenticationSignIn(
            in: viewModel,
            member: member
        ) else { return }
        await operation.value

        assertPostAuthenticationFailure(viewModel: viewModel, provider: provider)
    }

    @Test("Un fallo del directorio privado después de Auth termina la sesión")
    func memberListFailureTerminatesAuthenticatedSession() async {
        let member = postAuthenticationMember()
        let provider = ControlledSessionAuthProvider(
            signInResult: .success(postAuthenticationPrincipal(for: member))
        )
        let viewModel = makePostAuthenticationViewModel(
            member: member,
            provider: provider,
            resolver: SuccessfulPostAuthenticationResolver(member: member),
            failsMemberList: true
        )

        guard let operation = startPostAuthenticationSignIn(
            in: viewModel,
            member: member
        ) else { return }
        await operation.value

        assertPostAuthenticationFailure(viewModel: viewModel, provider: provider)
    }

    @Test("Un fallo post-mutación sin sign-out conserva el carril en drenaje")
    func failedPostMutationSignOutRejectsSuccessor() async {
        let member = postAuthenticationMember()
        let provider = ControlledSessionAuthProvider(
            signInResult: .failureAfterAuthenticationMutation(
                reason: .unknown,
                signedOut: false
            ),
            signOutResults: [false]
        )
        let viewModel = makePostAuthenticationViewModel(
            member: member,
            provider: provider,
            resolver: SuccessfulPostAuthenticationResolver(member: member)
        )

        guard let operation = startPostAuthenticationSignIn(
            in: viewModel,
            member: member
        ) else { return }
        await operation.value

        #expect(
            viewModel.mode == .unauthorized(
                email: member.normalizedEmail,
                reason: .userAccessRestricted
            )
        )
        #expect(viewModel.isSessionOperationDraining)
        #expect(viewModel.sessionOperationTask != nil)
        #expect(provider.isAuthenticated)
        #expect(provider.signOutCallCount == 1)

        viewModel.emailInput = member.normalizedEmail
        viewModel.passwordInput = "secret12"
        viewModel.signIn()
        #expect(provider.signInRequestCount == 1)
    }

    @Test("Un cleanup post-mutación confirmado expulsa también el refresh")
    func successfulPostMutationSignOutEndsAuthorizedRefresh() async {
        let member = postAuthenticationMember()
        let principal = postAuthenticationPrincipal(for: member)
        let provider = ControlledSessionAuthProvider(
            refreshResult: .failureAfterAuthenticationMutation(
                reason: .unknown,
                signedOut: true
            ),
            isAuthenticated: true
        )
        let viewModel = makePostAuthenticationViewModel(
            member: member,
            provider: provider,
            resolver: SuccessfulPostAuthenticationResolver(member: member)
        )
        viewModel.mode = .authorized(
            AuthorizedSession(
                principal: principal,
                authenticatedMember: member,
                member: member,
                members: [member],
                environment: .develop
            )
        )

        viewModel.refreshSession(trigger: .startup)
        guard let operation = viewModel.sessionOperationTask else {
            Issue.record("El refresh no conserva su tarea propietaria")
            return
        }
        await operation.value

        #expect(viewModel.mode == .signedOut)
        #expect(viewModel.sessionOperationState == .idle)
        #expect(viewModel.sessionOperationTask == nil)
        #expect(provider.isAuthenticated == false)
    }

    @Test("El fallo post-mutación de alta conserva el email registrado")
    func signUpPostMutationFailurePreservesRegistrationEmail() async {
        let member = postAuthenticationMember()
        let registrationEmail = "new-member@example.com"
        let provider = ControlledSessionAuthProvider(
            signUpResult: .failureAfterAuthenticationMutation(
                reason: .unknown,
                signedOut: false
            ),
            signOutResults: [true]
        )
        let viewModel = makePostAuthenticationViewModel(
            member: member,
            provider: provider,
            resolver: SuccessfulPostAuthenticationResolver(member: member)
        )
        viewModel.emailInput = "stale-sign-in@example.com"
        viewModel.registerEmailInput = "  NEW-MEMBER@example.com  "
        viewModel.registerPasswordInput = "secret12"
        viewModel.registerRepeatPasswordInput = "secret12"

        viewModel.signUp()
        guard let operation = viewModel.sessionOperationTask else {
            Issue.record("El alta no conserva su tarea propietaria")
            return
        }
        await operation.value

        #expect(
            viewModel.mode == .unauthorized(
                email: registrationEmail,
                reason: .userAccessRestricted
            )
        )
        #expect(viewModel.sessionOperationState == .idle)
        #expect(viewModel.sessionOperationTask == nil)
        #expect(provider.isAuthenticated == false)
        #expect(provider.signOutCallCount == 1)
    }
}

@MainActor
private func makePostAuthenticationViewModel(
    member: Member,
    provider: ControlledSessionAuthProvider,
    resolver: some AuthorizedMemberResolving,
    failsMemberList: Bool = false
) -> SessionViewModel {
    let repository = PostAuthenticationMemberRepository(
        member: member,
        failsMemberList: failsMemberList
    )
    let environmentRouter = FixedSessionEnvironmentRouter()
    return SessionViewModel(
        repository: repository,
        authSessionProvider: provider,
        resolveAuthorizedSession: ResolveAuthorizedSessionUseCase(
            repository: repository,
            resolver: resolver,
            environmentRouter: environmentRouter
        ),
        environmentRouter: environmentRouter
    )
}

@MainActor
private func startPostAuthenticationSignIn(in viewModel: SessionViewModel, member: Member) -> Task<Void, Never>? {
    viewModel.emailInput = member.normalizedEmail
    viewModel.passwordInput = "secret12"
    viewModel.signIn()
    guard let operation = viewModel.sessionOperationTask else {
        Issue.record("El login no conserva su tarea propietaria")
        return nil
    }
    return operation
}

@MainActor
private func assertPostAuthenticationFailure(viewModel: SessionViewModel, provider: ControlledSessionAuthProvider) {
    #expect(viewModel.mode == .signedOut)
    #expect(viewModel.sessionOperationState == .idle)
    #expect(viewModel.sessionOperationTask == nil)
    #expect(viewModel.isAuthenticating == false)
    #expect(viewModel.feedbackCenter.messageKey == AccessL10nKey.authErrorSessionData)
    #expect(provider.isAuthenticated == false)
    #expect(provider.signOutCallCount == 2)
}

@MainActor private func postAuthenticationMember() -> Member {
    Member(
        id: "post_auth_member",
        displayName: "Post Auth Member",
        normalizedEmail: "post-auth@example.com",
        authUid: "post_auth_uid",
        roles: [.member],
        isActive: true,
        producerCatalogEnabled: true
    )
}

private func postAuthenticationPrincipal(for member: Member) -> AuthPrincipal {
    AuthPrincipal(uid: member.authUid ?? "", email: member.normalizedEmail)
}

private enum PostAuthenticationTestError: Error {
    case failed
}

nonisolated private struct FailingPostAuthenticationResolver: AuthorizedMemberResolving {
    func resolve(
        authPrincipal _: AuthPrincipal,
        requestedEnvironment _: SessionEnvironment
    ) async throws -> AuthorizedMemberResolution {
        throw PostAuthenticationTestError.failed
    }
}

nonisolated private struct SuccessfulPostAuthenticationResolver: AuthorizedMemberResolving {
    let member: Member

    func resolve(
        authPrincipal _: AuthPrincipal,
        requestedEnvironment: SessionEnvironment
    ) async throws -> AuthorizedMemberResolution {
        AuthorizedMemberResolution(
            memberId: member.id,
            roles: member.roles,
            isActive: member.isActive,
            environment: requestedEnvironment,
            firstLoginLinked: false
        )
    }
}

nonisolated private struct PostAuthenticationMemberRepository: MemberRepository {
    let member: Member
    let failsMemberList: Bool

    func member(id: String) async throws -> Member? {
        id == member.id ? member : nil
    }

    func members(visibleTo _: Member) async throws -> [Member] {
        if failsMemberList {
            throw PostAuthenticationTestError.failed
        }
        return [member]
    }

    func updateOwnProducerCatalogEnabled(member _: Member, enabled _: Bool) async throws -> Member {
        member
    }
}
