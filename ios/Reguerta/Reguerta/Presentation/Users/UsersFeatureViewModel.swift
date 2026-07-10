import Foundation
import Observation

@MainActor
@Observable
final class UsersFeatureViewModel {
    @ObservationIgnored let sessionViewModel: SessionViewModel
    @ObservationIgnored let feedbackCenter: GlobalFeedbackCenter
    @ObservationIgnored let memberRepository: any MemberRepository
    @ObservationIgnored let upsertMemberByAdmin: any MemberAdminUpserting

    var currentSession: AuthorizedSession?
    var currentMember: Member?
    var membersFeed: [Member] = []
    var draft = MemberDraft()
    var editingMemberId: String?
    var isEditorOpen = false
    var pendingToggleActiveMemberId: String?
    var isLoadingMembers = false
    var isSavingMember = false
    var isTogglingMember = false
    var highlightedMemberId: String?

    var sortedMembers: [Member] {
        membersFeed.sorted { lhs, rhs in
            lhs.displayName.localizedCaseInsensitiveCompare(rhs.displayName) == .orderedAscending
        }
    }

    var editingMember: Member? {
        guard let editingMemberId else { return nil }
        return sortedMembers.first(where: { $0.id == editingMemberId })
    }

    var pendingToggleMember: Member? {
        guard let pendingToggleActiveMemberId else { return nil }
        return sortedMembers.first(where: { $0.id == pendingToggleActiveMemberId })
    }

    var canManageMembers: Bool {
        currentMember?.canManageMembers == true
    }

    var canGrantAdminRole: Bool {
        currentMember?.canGrantAdminRole == true
    }

    init(
        sessionViewModel: SessionViewModel,
        feedbackCenter: GlobalFeedbackCenter = GlobalFeedbackCenter(),
        memberRepository: any MemberRepository,
        upsertMemberByAdmin: any MemberAdminUpserting
    ) {
        self.sessionViewModel = sessionViewModel
        self.feedbackCenter = feedbackCenter
        self.memberRepository = memberRepository
        self.upsertMemberByAdmin = upsertMemberByAdmin
    }

    func handleSessionModeChange(_ mode: SessionMode) {
        switch mode {
        case .authorized(let session):
            let previousMemberId = currentSession?.member.id
            currentSession = session
            currentMember = session.member
            membersFeed = sortedMembers(from: session.members)
            if previousMemberId != session.member.id {
                clearEditor()
                pendingToggleActiveMemberId = nil
            }
            Task { await refreshMembers() }
        case .signedOut, .unauthorized:
            resetState()
        }
    }

    func refreshMembers() async {
        guard let session = currentSession else {
            resetState()
            return
        }

        isLoadingMembers = true
        let members = await memberRepository.allMembers()
        guard isCurrentSession(session) else {
            isLoadingMembers = false
            return
        }
        applyMembers(members, basedOn: session)
        isLoadingMembers = false
    }

    func startCreating() {
        guard canManageMembers else {
            feedbackCenter.show(AccessL10nKey.feedbackOnlyAdminCreate)
            return
        }

        draft = MemberDraft()
        editingMemberId = nil
        isEditorOpen = true
    }

    func startEditing(memberId: String) {
        guard canManageMembers else {
            feedbackCenter.show(AccessL10nKey.feedbackOnlyAdminCreate)
            return
        }
        guard let member = sortedMembers.first(where: { $0.id == memberId }) else { return }

        draft = member.toDraft()
        editingMemberId = member.id
        isEditorOpen = true
    }

    func updateDraft(_ draft: MemberDraft) {
        self.draft = draft
    }

    func clearEditor() {
        draft = MemberDraft()
        editingMemberId = nil
        isEditorOpen = false
    }

    func saveDraft() async -> Bool {
        await saveDraft(editingMemberId: editingMemberId, clearsEditor: true)
    }

    func createAuthorizedMember() async -> Bool {
        editingMemberId = nil
        return await saveDraft(editingMemberId: nil, clearsEditor: false)
    }

    func toggleAdmin(memberId: String) async -> Bool {
        guard let session = currentSession else { return false }
        guard canGrantAdminRole else {
            feedbackCenter.show(AccessL10nKey.feedbackOnlyAdminEditRoles)
            return false
        }
        guard let target = sortedMembers.first(where: { $0.id == memberId }) else { return false }

        var roles = target.roles
        if roles.contains(.admin) {
            roles.remove(.admin)
        } else {
            roles.insert(.admin)
        }
        if roles.isEmpty {
            roles.insert(.member)
        }

        isTogglingMember = true
        let updated = target.replacing(roles: roles)
        let saved = await persistMember(target: updated, session: session)
        isTogglingMember = false
        return saved
    }

    func toggleActive(memberId: String) async -> Bool {
        guard let session = currentSession else { return false }
        guard canManageMembers else {
            feedbackCenter.show(AccessL10nKey.feedbackOnlyAdminToggleActive)
            return false
        }
        guard let target = sortedMembers.first(where: { $0.id == memberId }) else { return false }

        isTogglingMember = true
        let saved = await persistMember(target: target.replacing(isActive: !target.isActive), session: session)
        isTogglingMember = false
        return saved
    }

    func requestToggleActive(memberId: String) {
        guard canManageMembers else {
            feedbackCenter.show(AccessL10nKey.feedbackOnlyAdminToggleActive)
            return
        }
        pendingToggleActiveMemberId = memberId
    }

    func confirmToggleActive() async -> Bool {
        guard let pendingToggleActiveMemberId else { return false }
        let saved = await toggleActive(memberId: pendingToggleActiveMemberId)
        self.pendingToggleActiveMemberId = nil
        return saved
    }

    func dismissToggleActive() {
        pendingToggleActiveMemberId = nil
    }

    private func saveDraft(editingMemberId: String?, clearsEditor: Bool) async -> Bool {
        guard let session = currentSession else { return false }

        switch draft.validated(
            editingMemberId: editingMemberId,
            members: membersFeed,
            canManageMembers: canManageMembers
        ) {
        case .failure(let error):
            feedbackCenter.show(error.feedbackKey)
            return false
        case .success(let validation):
            guard let target = buildTargetMember(
                editingMemberId: editingMemberId,
                normalizedEmail: validation.normalizedEmail,
                roles: validation.roles
            ) else {
                return false
            }

            isSavingMember = true
            let saved = await persistMember(target: target, session: session)
            isSavingMember = false
            if saved {
                draft = MemberDraft()
                if clearsEditor {
                    self.editingMemberId = nil
                    isEditorOpen = false
                }
            }
            return saved
        }
    }

    private func buildTargetMember(
        editingMemberId: String?,
        normalizedEmail: String,
        roles: Set<MemberRole>
    ) -> Member? {
        if let editingMemberId {
            guard let existing = membersFeed.first(where: { $0.id == editingMemberId }) else {
                return nil
            }
            return existing.replacing(
                displayName: draft.trimmedDisplayName,
                companyName: draft.normalizedCompanyName(roles: roles),
                phoneNumber: draft.normalizedPhoneNumber,
                normalizedEmail: normalizedEmail,
                roles: roles,
                isActive: draft.isActive,
                isCommonPurchaseManager: draft.isCommonPurchaseManager
            )
        }

        let newId = buildMemberId(from: normalizedEmail)
        guard !membersFeed.contains(where: { $0.id == newId }) else {
            feedbackCenter.show(AccessL10nKey.feedbackMemberExists)
            return nil
        }

        return Member(
            id: newId,
            displayName: draft.trimmedDisplayName,
            companyName: draft.normalizedCompanyName(roles: roles),
            phoneNumber: draft.normalizedPhoneNumber,
            normalizedEmail: normalizedEmail,
            authUid: nil,
            roles: roles,
            isActive: draft.isActive,
            producerCatalogEnabled: true,
            isCommonPurchaseManager: draft.isCommonPurchaseManager
        )
    }

    private func persistMember(target: Member, session: AuthorizedSession) async -> Bool {
        do {
            let updated = try await upsertMemberByAdmin.execute(
                actorAuthUid: session.principal.uid,
                target: target
            )
            let members = await memberRepository.allMembers()
            sessionViewModel.applyUpdatedAuthorizedMember(updated, members: members)
            syncFromSessionViewModel()
            highlightMember(updated.id)
            return true
        } catch MemberManagementError.accessDenied {
            feedbackCenter.show(AccessL10nKey.feedbackOnlyAdminManageMembers)
        } catch MemberManagementError.lastAdminRemoval {
            feedbackCenter.show(AccessL10nKey.feedbackCannotRemoveLastAdmin)
        } catch {
            feedbackCenter.show(AccessL10nKey.feedbackUnableSaveChanges)
        }
        return false
    }

    private func applyMembers(_ members: [Member], basedOn session: AuthorizedSession) {
        let refreshedCurrent = members.first(where: { $0.id == session.member.id }) ?? session.member
        let refreshedAuthenticated = members.first(where: { $0.id == session.authenticatedMember.id })
            ?? session.authenticatedMember
        let refreshedSession = AuthorizedSession(
            principal: session.principal,
            authenticatedMember: refreshedAuthenticated,
            member: refreshedCurrent,
            members: members
        )

        currentSession = refreshedSession
        currentMember = refreshedCurrent
        membersFeed = sortedMembers(from: members)
        if sessionViewModel.mode != .authorized(refreshedSession) {
            sessionViewModel.mode = .authorized(refreshedSession)
        }
    }

    private func syncFromSessionViewModel() {
        guard case .authorized(let session) = sessionViewModel.mode else {
            resetState()
            return
        }
        currentSession = session
        currentMember = session.member
        membersFeed = sortedMembers(from: session.members)
    }

    private func resetState() {
        currentSession = nil
        currentMember = nil
        membersFeed = []
        draft = MemberDraft()
        editingMemberId = nil
        isEditorOpen = false
        pendingToggleActiveMemberId = nil
        isLoadingMembers = false
        isSavingMember = false
        isTogglingMember = false
        highlightedMemberId = nil
    }

    private func isCurrentSession(_ session: AuthorizedSession) -> Bool {
        currentSession?.principal == session.principal &&
            currentSession?.member.id == session.member.id &&
            currentSession?.authenticatedMember.id == session.authenticatedMember.id
    }

    private func sortedMembers(from members: [Member]) -> [Member] {
        members.sorted {
            $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending
        }
    }

}

private extension UsersFeatureViewModel {
    func highlightMember(_ memberId: String) {
        highlightedMemberId = memberId
        Task { [weak self] in
            try? await Task.sleep(nanoseconds: 1_600_000_000)
            await MainActor.run {
                if self?.highlightedMemberId == memberId {
                    self?.highlightedMemberId = nil
                }
            }
        }
    }
}

private extension Member {
    func replacing(
        displayName: String? = nil,
        companyName: String?? = nil,
        phoneNumber: String?? = nil,
        normalizedEmail: String? = nil,
        roles: Set<MemberRole>? = nil,
        isActive: Bool? = nil,
        isCommonPurchaseManager: Bool? = nil
    ) -> Member {
        Member(
            id: id,
            displayName: displayName ?? self.displayName,
            companyName: companyName ?? self.companyName,
            phoneNumber: phoneNumber ?? self.phoneNumber,
            normalizedEmail: normalizedEmail ?? self.normalizedEmail,
            authUid: authUid,
            roles: roles ?? self.roles,
            isActive: isActive ?? self.isActive,
            producerCatalogEnabled: producerCatalogEnabled,
            isCommonPurchaseManager: isCommonPurchaseManager ?? self.isCommonPurchaseManager,
            producerParity: producerParity,
            ecoCommitmentMode: ecoCommitmentMode,
            ecoCommitmentParity: ecoCommitmentParity
        )
    }
}
