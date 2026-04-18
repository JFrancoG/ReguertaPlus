import Foundation

extension SessionViewModel {
    func createAuthorizedMember() {
        saveMemberDraft(editingMemberId: nil)
    }

    func saveMemberDraft(
        editingMemberId: String?,
        onSuccess: @escaping () -> Void = {}
    ) {
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
        if roles.contains(.producer) && memberDraft.companyName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            feedbackMessageKey = AccessL10nKey.feedbackProducerCompanyRequired
            return
        }

        if session.members.contains(where: {
            $0.normalizedEmail == normalizedEmail && $0.id != editingMemberId
        }) {
            feedbackMessageKey = AccessL10nKey.feedbackMemberExists
            return
        }

        let member: Member
        if let editingMemberId {
            guard let existing = session.members.first(where: { $0.id == editingMemberId }) else {
                return
            }
            member = Member(
                id: existing.id,
                displayName: memberDraft.displayName.trimmingCharacters(in: .whitespacesAndNewlines),
                companyName: normalizedCompanyName(from: memberDraft, roles: roles),
                phoneNumber: normalizedPhoneNumber(from: memberDraft),
                normalizedEmail: normalizedEmail,
                authUid: existing.authUid,
                roles: roles,
                isActive: memberDraft.isActive,
                producerCatalogEnabled: existing.producerCatalogEnabled,
                isCommonPurchaseManager: memberDraft.isCommonPurchaseManager,
                producerParity: existing.producerParity,
                ecoCommitmentMode: existing.ecoCommitmentMode,
                ecoCommitmentParity: existing.ecoCommitmentParity
            )
        } else {
            let newId = buildMemberId(from: normalizedEmail)
            if session.members.contains(where: { $0.id == newId }) {
                feedbackMessageKey = AccessL10nKey.feedbackMemberExists
                return
            }
            member = Member(
                id: newId,
                displayName: memberDraft.displayName.trimmingCharacters(in: .whitespacesAndNewlines),
                companyName: normalizedCompanyName(from: memberDraft, roles: roles),
                phoneNumber: normalizedPhoneNumber(from: memberDraft),
                normalizedEmail: normalizedEmail,
                authUid: nil,
                roles: roles,
                isActive: memberDraft.isActive,
                producerCatalogEnabled: true,
                isCommonPurchaseManager: memberDraft.isCommonPurchaseManager
            )
        }

        Task { @MainActor in
            let saved = await persistMember(target: member, session: session)
            if saved {
                memberDraft = MemberDraft()
                onSuccess()
            }
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
            companyName: target.companyName,
            phoneNumber: target.phoneNumber,
            normalizedEmail: target.normalizedEmail,
            authUid: target.authUid,
            roles: roles,
            isActive: target.isActive,
            producerCatalogEnabled: target.producerCatalogEnabled,
            isCommonPurchaseManager: target.isCommonPurchaseManager,
            producerParity: target.producerParity,
            ecoCommitmentMode: target.ecoCommitmentMode,
            ecoCommitmentParity: target.ecoCommitmentParity
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
            companyName: target.companyName,
            phoneNumber: target.phoneNumber,
            normalizedEmail: target.normalizedEmail,
            authUid: target.authUid,
            roles: target.roles,
            isActive: !target.isActive,
            producerCatalogEnabled: target.producerCatalogEnabled,
            isCommonPurchaseManager: target.isCommonPurchaseManager,
            producerParity: target.producerParity,
            ecoCommitmentMode: target.ecoCommitmentMode,
            ecoCommitmentParity: target.ecoCommitmentParity
        )

        Task { @MainActor in
            await persistMember(target: updated, session: session)
        }
    }

    func refreshMembers() {
        guard case .authorized(let session) = mode else {
            return
        }

        Task { @MainActor in
            let members = await repository.allMembers()
            let refreshedCurrent = members.first(where: { $0.id == session.member.id }) ?? session.member
            let refreshedAuthenticated = members.first(where: { $0.id == session.authenticatedMember.id })
                ?? session.authenticatedMember
            mode = .authorized(
                AuthorizedSession(
                    principal: session.principal,
                    authenticatedMember: refreshedAuthenticated,
                    member: refreshedCurrent,
                    members: members
                )
            )
        }
    }

    private func persistMember(target: Member, session: AuthorizedSession) async -> Bool {
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
            return true
        } catch MemberManagementError.accessDenied {
            feedbackMessageKey = AccessL10nKey.feedbackOnlyAdminManageMembers
        } catch MemberManagementError.lastAdminRemoval {
            feedbackMessageKey = AccessL10nKey.feedbackCannotRemoveLastAdmin
        } catch {
            feedbackMessageKey = AccessL10nKey.feedbackUnableSaveChanges
        }
        return false
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

    private func normalizedCompanyName(from draft: MemberDraft, roles: Set<MemberRole>) -> String? {
        guard roles.contains(.producer) else {
            return nil
        }
        let trimmed = draft.companyName.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private func normalizedPhoneNumber(from draft: MemberDraft) -> String? {
        let trimmed = draft.phoneNumber.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
