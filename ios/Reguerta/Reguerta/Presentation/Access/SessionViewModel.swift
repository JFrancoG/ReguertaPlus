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
    case unauthorized(email: String, message: String)
    case authorized(AuthorizedSession)
}

@MainActor
@Observable
final class SessionViewModel {
    var emailInput = ""
    var uidInput = ""
    var isAuthenticating = false
    var mode: SessionMode = .signedOut
    var memberDraft = MemberDraft()
    var feedbackMessage: String?

    private let repository: any MemberRepository
    private let resolveAuthorizedSession: ResolveAuthorizedSessionUseCase
    private let upsertMemberByAdmin: UpsertMemberByAdminUseCase

    init(
        repository: (any MemberRepository)? = nil,
        resolveAuthorizedSession: ResolveAuthorizedSessionUseCase? = nil,
        upsertMemberByAdmin: UpsertMemberByAdminUseCase? = nil
    ) {
        let selectedRepository = repository ?? ChainedMemberRepository(
            primary: FirestoreMemberRepository(),
            fallback: InMemoryMemberRepository()
        )
        self.repository = selectedRepository
        self.resolveAuthorizedSession = resolveAuthorizedSession ?? ResolveAuthorizedSessionUseCase(repository: selectedRepository)
        self.upsertMemberByAdmin = upsertMemberByAdmin ?? UpsertMemberByAdminUseCase(repository: selectedRepository)
    }

    func signIn() {
        let email = emailInput.trimmingCharacters(in: .whitespacesAndNewlines)
        let uid = uidInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !email.isEmpty, !uid.isEmpty else {
            feedbackMessage = "Email and UID are required"
            return
        }

        isAuthenticating = true
        Task {
            let result = await resolveAuthorizedSession.execute(
                authPrincipal: AuthPrincipal(uid: uid, email: email)
            )

            switch result {
            case .authorized(let member):
                let members = await repository.allMembers()
                mode = .authorized(
                    AuthorizedSession(
                        principal: AuthPrincipal(uid: uid, email: email),
                        member: member,
                        members: members
                    )
                )
            case .unauthorized(let message):
                mode = .unauthorized(email: email, message: message)
            }

            isAuthenticating = false
        }
    }

    func signOut() {
        uidInput = ""
        mode = .signedOut
        memberDraft = MemberDraft()
    }

    func createAuthorizedMember() {
        guard case .authorized(let session) = mode else {
            return
        }
        guard session.member.isAdmin else {
            feedbackMessage = "Only admins can create members"
            return
        }

        let normalizedEmail = normalizeEmail(memberDraft.email)
        guard !memberDraft.displayName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !normalizedEmail.isEmpty else {
            feedbackMessage = "Display name and email are required"
            return
        }

        let roles = buildRoles(from: memberDraft)
        guard !roles.isEmpty else {
            feedbackMessage = "Select at least one role"
            return
        }

        if session.members.contains(where: { $0.normalizedEmail == normalizedEmail }) {
            feedbackMessage = "Member already exists"
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
            feedbackMessage = "Only admins can edit roles"
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
            feedbackMessage = "Only admins can activate or deactivate"
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
        feedbackMessage = nil
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
            feedbackMessage = "Only admins can manage members"
        } catch MemberManagementError.lastAdminRemoval {
            feedbackMessage = "Cannot leave the app without active admins"
        } catch {
            feedbackMessage = "Unable to save changes"
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
