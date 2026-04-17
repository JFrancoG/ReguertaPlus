import Foundation

extension SessionViewModel {
    func createAuthorizedMember() {
        guard case .authorized(let session) = mode else {
            return
        }
        guard session.member.canManageMembers else {
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
            producerCatalogEnabled: true,
            isCommonPurchaseManager: false
        )

        Task { @MainActor in
            await persistMember(target: member, session: session)
            memberDraft = MemberDraft()
        }
    }

    func toggleAdmin(memberId: String) {
        guard case .authorized(let session) = mode else {
            return
        }
        guard session.member.canGrantAdminRole else {
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
            producerCatalogEnabled: target.producerCatalogEnabled,
            isCommonPurchaseManager: target.isCommonPurchaseManager
        )

        Task { @MainActor in
            await persistMember(target: updated, session: session)
        }
    }

    func toggleActive(memberId: String) {
        guard case .authorized(let session) = mode else {
            return
        }
        guard session.member.canManageMembers else {
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
            producerCatalogEnabled: target.producerCatalogEnabled,
            isCommonPurchaseManager: target.isCommonPurchaseManager
        )

        Task { @MainActor in
            await persistMember(target: updated, session: session)
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
            let refreshedAuthenticated = updated.id == session.authenticatedMember.id ? updated : session.authenticatedMember
            mode = .authorized(
                AuthorizedSession(
                    principal: session.principal,
                    authenticatedMember: refreshedAuthenticated,
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
