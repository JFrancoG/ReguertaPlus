import Foundation
import Testing

@testable import Reguerta

@MainActor
struct FirebaseAuthSessionSecurityTests {
    @Test func signUpKeepsSessionLockedWhenFirebaseSignOutFails() async {
        let feedbackCenter = GlobalFeedbackCenter()
        let viewModel = SessionViewModel(
            repository: InMemoryMemberRepository(),
            feedbackCenter: feedbackCenter,
            authSessionProvider: TestAuthSessionProvider(
                signUpResult: .verificationRequired(
                    email: "new.member@example.com",
                    verificationSent: true,
                    signedOut: false
                )
            )
        )
        viewModel.registerEmailInput = "new.member@example.com"
        viewModel.registerPasswordInput = "secret12"
        viewModel.registerRepeatPasswordInput = "secret12"

        viewModel.signUp()
        await waitForCondition { !viewModel.isRegistering }

        #expect(
            viewModel.mode == .unauthorized(
                email: "new.member@example.com",
                reason: .emailVerificationRequired
            )
        )
        #expect(feedbackCenter.messageKey == AccessL10nKey.authInfoVerificationSent)
    }

    @Test func verificationResendKeepsSessionLockedWhenFirebaseSignOutFails() async {
        let repository = InMemoryMemberRepository()
        let environmentRouter = FixedSessionEnvironmentRouter()
        let provider = TestAuthSessionProvider(
            signInResult: .success(
                AuthPrincipal(uid: "auth_1", email: "member@example.com")
            ),
            verificationSent: true,
            signOutSucceeds: false
        )
        let viewModel = SessionViewModel(
            repository: repository,
            feedbackCenter: GlobalFeedbackCenter(),
            authSessionProvider: provider,
            resolveAuthorizedSession: ResolveAuthorizedSessionUseCase(
                repository: repository,
                resolver: VerificationRequiredResolver(),
                environmentRouter: environmentRouter
            ),
            environmentRouter: environmentRouter
        )
        viewModel.emailInput = "member@example.com"
        viewModel.passwordInput = "secret12"

        viewModel.signIn()
        await waitForCondition { !viewModel.isAuthenticating }

        #expect(
            viewModel.mode == .unauthorized(
                email: "member@example.com",
                reason: .emailVerificationRequired
            )
        )
        #expect(viewModel.feedbackCenter.messageKey == AccessL10nKey.authInfoVerificationResent)
    }

    @Test func expiredSessionFailsClosedWhenFirebaseSignOutFails() async {
        let member = authenticatedMember()
        let viewModel = SessionViewModel(
            repository: InMemoryMemberRepository(items: [member]),
            authSessionProvider: TestAuthSessionProvider(signOutSucceeds: false)
        )
        viewModel.mode = authorizedMode(member: member)

        await viewModel.handleExpiredSession()

        #expect(
            viewModel.mode == .unauthorized(
                email: member.normalizedEmail,
                reason: .userAccessRestricted
            )
        )
        #expect(viewModel.showSessionExpiredDialog)
        #expect(viewModel.feedbackCenter.messageKey == AccessL10nKey.authErrorUnknown)
    }

    @Test func manualSignOutFailsClosedWhenFirebaseSignOutFails() {
        let member = authenticatedMember()
        let viewModel = SessionViewModel(
            repository: InMemoryMemberRepository(items: [member]),
            authSessionProvider: TestAuthSessionProvider(signOutSucceeds: false)
        )
        viewModel.mode = authorizedMode(member: member)

        viewModel.signOut()

        #expect(
            viewModel.mode == .unauthorized(
                email: member.normalizedEmail,
                reason: .userAccessRestricted
            )
        )
        #expect(viewModel.showUnauthorizedDialog)
        #expect(viewModel.feedbackCenter.messageKey == AccessL10nKey.authErrorUnknown)
    }

    @Test func deviceRegistrationFailureIsAnExplicitBestEffortPolicy() async {
        let member = authenticatedMember()
        let repository = InMemoryMemberRepository(items: [member])
        let environmentRouter = FixedSessionEnvironmentRouter()
        let viewModel = SessionViewModel(
            repository: repository,
            authSessionProvider: TestAuthSessionProvider(),
            resolveAuthorizedSession: ResolveAuthorizedSessionUseCase(
                repository: repository,
                resolver: SuccessfulAuthorizedMemberResolver(member: member),
                environmentRouter: environmentRouter
            ),
            authorizedDeviceRegistrar: FailingAuthorizedDeviceRegistrar(),
            environmentRouter: environmentRouter
        )

        await viewModel.applyAuthorizedSession(
            principal: AuthPrincipal(uid: "auth_1", email: member.normalizedEmail)
        )

        guard case .authorized(let session) = viewModel.mode else {
            Issue.record("Device registration is best-effort and must not reject an authorized member")
            return
        }
        #expect(session.authenticatedMember == member)
    }

    private func authenticatedMember() -> Member {
        Member(
            id: "member_1",
            displayName: "Member",
            normalizedEmail: "member@example.com",
            authUid: "auth_1",
            roles: [.member],
            isActive: true,
            producerCatalogEnabled: true
        )
    }

    private func authorizedMode(member: Member) -> SessionMode {
        .authorized(
            AuthorizedSession(
                principal: AuthPrincipal(uid: "auth_1", email: member.normalizedEmail),
                authenticatedMember: member,
                member: member,
                members: [member],
                environment: .develop
            )
        )
    }
}

nonisolated private struct VerificationRequiredResolver: AuthorizedMemberResolving {
    func resolve(
        authPrincipal _: AuthPrincipal,
        requestedEnvironment _: SessionEnvironment
    ) async throws -> AuthorizedMemberResolution {
        throw AuthorizedMemberResolutionError.unauthorized(.emailVerificationRequired)
    }
}

nonisolated private struct SuccessfulAuthorizedMemberResolver: AuthorizedMemberResolving {
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

nonisolated private struct FailingAuthorizedDeviceRegistrar: AuthorizedDeviceRegistrar {
    func register(
        command: AuthorizedDeviceRegistrationCommand,
        isSessionCurrent: @escaping @MainActor @Sendable () -> Bool
    ) async throws -> AuthorizedDeviceRegistrationResult {
        .failed
    }

    func updateRegistrationToken(_ token: String?) async throws {}

    func clearAuthorization(ifOwnedBy lease: AuthorizedDeviceSessionLease) async throws {}
}
