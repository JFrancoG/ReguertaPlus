import Foundation
import Observation

struct MemberDraft: Equatable, Sendable {
    var displayName = ""
    var email = ""
    var isMember = true
    var isProducer = false
    var isAdmin = false
    var isActive = true
}

struct AuthorizedSession: Equatable, Sendable {
    var principal: AuthPrincipal
    var member: Member
    var members: [Member]
}

enum SessionMode: Equatable, Sendable {
    case signedOut
    case unauthorized(email: String, reason: UnauthorizedReason)
    case authorized(AuthorizedSession)
}

@MainActor
@Observable
final class SessionViewModel {
    var emailInput = "" {
        didSet {
            if oldValue != emailInput {
                emailErrorKey = nil
            }
        }
    }
    var passwordInput = "" {
        didSet {
            if oldValue != passwordInput {
                passwordErrorKey = nil
            }
        }
    }
    var emailErrorKey: String?
    var passwordErrorKey: String?
    var isAuthenticating = false
    var mode: SessionMode = .signedOut
    var memberDraft = MemberDraft()
    var feedbackMessageKey: String?

    private let repository: any MemberRepository
    private let authSessionProvider: any AuthSessionProvider
    private let resolveAuthorizedSession: ResolveAuthorizedSessionUseCase
    private let upsertMemberByAdmin: UpsertMemberByAdminUseCase

    var canSubmitSignIn: Bool {
        !isAuthenticating &&
            !normalizeEmail(emailInput).isEmpty &&
            normalizeEmail(emailInput).isValidEmail &&
            !passwordInput.isEmpty
    }

    init(
        repository: (any MemberRepository)? = nil,
        authSessionProvider: (any AuthSessionProvider)? = nil,
        resolveAuthorizedSession: ResolveAuthorizedSessionUseCase? = nil,
        upsertMemberByAdmin: UpsertMemberByAdminUseCase? = nil
    ) {
        let selectedRepository = repository ?? ChainedMemberRepository(
            primary: FirestoreMemberRepository(),
            fallback: InMemoryMemberRepository()
        )
        let selectedAuthProvider = authSessionProvider ?? {
            if ProcessInfo.processInfo.arguments.contains("-useMockAuth") {
                return MockAuthSessionProvider()
            }
            return FirebaseAuthSessionProvider()
        }()
        self.repository = selectedRepository
        self.authSessionProvider = selectedAuthProvider
        self.resolveAuthorizedSession = resolveAuthorizedSession ?? ResolveAuthorizedSessionUseCase(repository: selectedRepository)
        self.upsertMemberByAdmin = upsertMemberByAdmin ?? UpsertMemberByAdminUseCase(repository: selectedRepository)
    }

    func signIn() {
        let email = emailInput.trimmingCharacters(in: .whitespacesAndNewlines)
        let password = passwordInput
        feedbackMessageKey = nil
        emailErrorKey = nil
        passwordErrorKey = nil

        guard validateSignInInputs(email: email, password: password) else {
            return
        }

        isAuthenticating = true
        Task {
            let authResult = await authSessionProvider.signIn(email: email, password: password)

            switch authResult {
            case .success(let principal):
                let result = await resolveAuthorizedSession.execute(authPrincipal: principal)
                switch result {
                case .authorized(let member):
                    let members = await repository.allMembers()
                    mode = .authorized(
                        AuthorizedSession(
                            principal: principal,
                            member: member,
                            members: members
                        )
                    )
                case .unauthorized(let reason):
                    mode = .unauthorized(email: principal.email, reason: reason)
                }
            case .failure(let reason):
                applySignInFailure(reason)
            }

            isAuthenticating = false
        }
    }

    func signOut() {
        authSessionProvider.signOut()
        passwordInput = ""
        emailErrorKey = nil
        passwordErrorKey = nil
        mode = .signedOut
        memberDraft = MemberDraft()
    }

    func createAuthorizedMember() {
        guard case .authorized(let session) = mode else {
            return
        }
        guard session.member.isAdmin else {
            feedbackMessageKey = AccessL10nKey.feedbackOnlyAdminCreate
            return
        }

        let normalizedEmail = normalizeEmail(memberDraft.email)
        guard !memberDraft.displayName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !normalizedEmail.isEmpty else {
            feedbackMessageKey = AccessL10nKey.feedbackDisplayNameEmailRequired
            return
        }

        let roles = buildRoles(from: memberDraft)
        guard !roles.isEmpty else {
            feedbackMessageKey = AccessL10nKey.feedbackSelectRole
            return
        }

        if session.members.contains(where: { $0.normalizedEmail == normalizedEmail }) {
            feedbackMessageKey = AccessL10nKey.feedbackMemberExists
            return
        }

        let member = Member(
            id: buildMemberId(from: normalizedEmail),
            displayName: memberDraft.displayName.trimmingCharacters(in: .whitespacesAndNewlines),
            normalizedEmail: normalizedEmail,
            authUid: nil,
            roles: roles,
            isActive: memberDraft.isActive,
            producerCatalogEnabled: true
        )

        Task {
            await persistMember(target: member, session: session)
            memberDraft = MemberDraft()
        }
    }

    func toggleAdmin(memberId: String) {
        guard case .authorized(let session) = mode else {
            return
        }
        guard session.member.isAdmin else {
            feedbackMessageKey = AccessL10nKey.feedbackOnlyAdminEditRoles
            return
        }
        guard let target = session.members.first(where: { $0.id == memberId }) else {
            return
        }

        var roles = target.roles
        if roles.contains(.admin) {
            roles.remove(.admin)
        } else {
            roles.insert(.admin)
        }
        if roles.isEmpty {
            roles.insert(.member)
        }

        let updated = Member(
            id: target.id,
            displayName: target.displayName,
            normalizedEmail: target.normalizedEmail,
            authUid: target.authUid,
            roles: roles,
            isActive: target.isActive,
            producerCatalogEnabled: target.producerCatalogEnabled
        )

        Task {
            await persistMember(target: updated, session: session)
        }
    }

    func toggleActive(memberId: String) {
        guard case .authorized(let session) = mode else {
            return
        }
        guard session.member.isAdmin else {
            feedbackMessageKey = AccessL10nKey.feedbackOnlyAdminToggleActive
            return
        }
        guard let target = session.members.first(where: { $0.id == memberId }) else {
            return
        }

        let updated = Member(
            id: target.id,
            displayName: target.displayName,
            normalizedEmail: target.normalizedEmail,
            authUid: target.authUid,
            roles: target.roles,
            isActive: !target.isActive,
            producerCatalogEnabled: target.producerCatalogEnabled
        )

        Task {
            await persistMember(target: updated, session: session)
        }
    }

    func clearFeedbackMessage() {
        feedbackMessageKey = nil
    }

    private func validateSignInInputs(email: String, password: String) -> Bool {
        var isValid = true

        if email.isEmpty {
            emailErrorKey = AccessL10nKey.feedbackEmailRequired
            isValid = false
        } else if !email.isValidEmail {
            emailErrorKey = AccessL10nKey.feedbackEmailInvalid
            isValid = false
        }

        if password.isEmpty {
            passwordErrorKey = AccessL10nKey.feedbackPasswordRequired
            isValid = false
        }

        return isValid
    }

    private func applySignInFailure(_ reason: AuthSignInFailureReason) {
        switch reason {
        case .invalidEmail:
            emailErrorKey = AccessL10nKey.feedbackEmailInvalid
        case .invalidCredentials:
            passwordErrorKey = AccessL10nKey.authErrorInvalidCredentials
        case .userNotFound:
            emailErrorKey = AccessL10nKey.authErrorUserNotFound
        case .userDisabled:
            emailErrorKey = AccessL10nKey.authErrorUserDisabled
        case .tooManyRequests:
            feedbackMessageKey = AccessL10nKey.authErrorTooManyRequests
        case .network:
            feedbackMessageKey = AccessL10nKey.authErrorNetwork
        case .unknown:
            feedbackMessageKey = AccessL10nKey.authErrorUnknown
        }
    }

    private func persistMember(target: Member, session: AuthorizedSession) async {
        do {
            let updated = try await upsertMemberByAdmin.execute(
                actorAuthUid: session.principal.uid,
                target: target
            )
            let members = await repository.allMembers()
            let refreshedCurrent = updated.id == session.member.id ? updated : session.member
            mode = .authorized(
                AuthorizedSession(
                    principal: session.principal,
                    member: refreshedCurrent,
                    members: members
                )
            )
        } catch MemberManagementError.accessDenied {
            feedbackMessageKey = AccessL10nKey.feedbackOnlyAdminManageMembers
        } catch MemberManagementError.lastAdminRemoval {
            feedbackMessageKey = AccessL10nKey.feedbackCannotRemoveLastAdmin
        } catch {
            feedbackMessageKey = AccessL10nKey.feedbackUnableSaveChanges
        }
    }

    private func normalizeEmail(_ email: String) -> String {
        email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private func buildRoles(from draft: MemberDraft) -> Set<MemberRole> {
        var roles: Set<MemberRole> = []
        if draft.isMember { roles.insert(.member) }
        if draft.isProducer { roles.insert(.producer) }
        if draft.isAdmin { roles.insert(.admin) }
        return roles
    }

    private func buildMemberId(from normalizedEmail: String) -> String {
        let sanitized = normalizedEmail
            .replacingOccurrences(of: "[^a-z0-9]+", with: "_", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "_"))
        let suffix = sanitized.isEmpty ? "member" : String(sanitized.prefix(40))
        return "member_\(suffix)"
    }
}

private extension String {
    var isValidEmail: Bool {
        range(
            of: "^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$",
            options: [.regularExpression, .caseInsensitive]
        ) != nil
    }
}

extension SessionMode {
    var isAuthenticatedSession: Bool {
        switch self {
        case .authorized, .unauthorized:
            return true
        case .signedOut:
            return false
        }
    }
}
