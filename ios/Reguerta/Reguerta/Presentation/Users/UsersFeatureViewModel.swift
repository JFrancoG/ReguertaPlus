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
    var editorRevision: UInt64 = 0
    var sessionIdentityEpoch: UInt64 = 0
    var activeRefreshOperationId: UInt64?
    var nextRefreshOperationId: UInt64 = 0
    var activeMutationOperationId: UInt64?
    var nextMutationOperationId: UInt64 = 0

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
            adoptAuthorizedSession(session, sourceMayContainPrivateMembers: true)
            Task { await refreshMembers() }
        case .signedOut, .unauthorized:
            sessionIdentityEpoch += 1
            resetState()
        }
    }

    func refreshMembers() async {
        guard let context = authorizedSessionContext else {
            resetState()
            return
        }
        let session = context.session
        let refreshOperationId = beginRefreshOperation()
        defer { finishRefreshOperation(refreshOperationId) }

        let members: [Member]
        do {
            members = try await memberRepository.members(visibleTo: session.member)
            try Task.checkCancellation()
        } catch is CancellationError {
            return
        } catch {
            if isCurrentRefresh(refreshOperationId, context: context) {
                feedbackCenter.show(AccessL10nKey.feedbackUnableLoadData)
            }
            return
        }
        guard isCurrentRefresh(refreshOperationId, context: context) else { return }
        let requiresDirectoryRefresh = applyMembers(members, basedOn: session)
        if requiresDirectoryRefresh {
            finishRefreshOperation(refreshOperationId)
            await refreshMembers()
        }
    }

    func startCreating() {
        guard canManageMembers else {
            feedbackCenter.show(AccessL10nKey.feedbackOnlyAdminCreate)
            return
        }

        draft = MemberDraft()
        editingMemberId = nil
        isEditorOpen = true
        editorRevision += 1
    }

    func startEditing(memberId: String) {
        guard canManageMembers else {
            feedbackCenter.show(AccessL10nKey.feedbackOnlyAdminCreate)
            return
        }
        guard let member = sortedMembers.first(where: { $0.id == memberId }) else { return }

        draft = member.toDraft()
        if draft.isCommonPurchaseManager {
            draft.setCommonPurchaseManagerSelection(
                true,
                commonPurchasesCompanyName: l10n(AccessL10nKey.usersEditorCommonPurchaseCompanyName)
            )
        }
        editingMemberId = member.id
        isEditorOpen = true
        editorRevision += 1
    }

    func updateDraft(_ draft: MemberDraft) {
        self.draft = draft
        editorRevision += 1
    }

    func setProducer(_ isSelected: Bool) {
        draft.setProducerSelection(isSelected)
        editorRevision += 1
    }

    func setCommonPurchaseManager(_ isSelected: Bool) {
        draft.setCommonPurchaseManagerSelection(
            isSelected,
            commonPurchasesCompanyName: l10n(AccessL10nKey.usersEditorCommonPurchaseCompanyName)
        )
        editorRevision += 1
    }

    func clearEditor() {
        draft = MemberDraft()
        editingMemberId = nil
        isEditorOpen = false
        editorRevision += 1
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
        guard activeMutationOperationId == nil, !isSavingMember, !isTogglingMember else { return false }
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

        let updated = target.replacing(roles: roles)
        return await persistMember(target: updated, session: session, kind: .toggle)
    }

    func toggleActive(memberId: String) async -> Bool {
        guard let session = currentSession else { return false }
        guard activeMutationOperationId == nil, !isSavingMember, !isTogglingMember else { return false }
        guard canManageMembers else {
            feedbackCenter.show(AccessL10nKey.feedbackOnlyAdminToggleActive)
            return false
        }
        guard let target = sortedMembers.first(where: { $0.id == memberId }) else { return false }

        return await persistMember(
            target: target.replacing(isActive: !target.isActive),
            session: session,
            kind: .toggle
        )
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
        self.pendingToggleActiveMemberId = nil
        return await toggleActive(memberId: pendingToggleActiveMemberId)
    }

    func dismissToggleActive() {
        pendingToggleActiveMemberId = nil
    }

}

private extension UsersFeatureViewModel {
    func saveDraft(editingMemberId: String?, clearsEditor: Bool) async -> Bool {
        guard let session = currentSession else { return false }
        guard activeMutationOperationId == nil, !isSavingMember, !isTogglingMember else { return false }

        switch draft.validated(
            editingMemberId: editingMemberId,
            members: membersFeed,
            canManageMembers: canManageMembers
        ) {
        case .failure(let error):
            feedbackCenter.show(error.feedbackKey)
            return false
        case .success(let validation):
            let saveEditorRevision = editorRevision
            let saveEditingMemberId = self.editingMemberId
            guard let target = buildTargetMember(
                editingMemberId: editingMemberId,
                normalizedEmail: validation.normalizedEmail,
                roles: validation.roles
            ) else {
                return false
            }

            let saved = await persistMember(target: target, session: session, kind: .save)
            if saved,
               editorRevision == saveEditorRevision,
               self.editingMemberId == saveEditingMemberId {
                draft = MemberDraft()
                editorRevision += 1
                if clearsEditor {
                    self.editingMemberId = nil
                    isEditorOpen = false
                }
            }
            return saved
        }
    }

    func buildTargetMember(
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

    func persistMember(
        target: Member,
        session: AuthorizedSession,
        kind: MemberMutationKind
    ) async -> Bool {
        let context = SessionContext(session: session, generation: sessionIdentityEpoch)
        guard isCurrentSession(context), activeMutationOperationId == nil else { return false }
        do {
            try Task.checkCancellation()
        } catch {
            return false
        }
        let operationId = beginMutation(kind: kind)
        defer { finishMutation(operationId) }

        let updated: Member
        do {
            updated = try await upsertMemberByAdmin.execute(target: target)
        } catch is CancellationError {
            return false
        } catch {
            if isCurrentMutation(operationId, context: context) {
                showMemberMutationFailure(error)
            }
            return false
        }
        guard isCurrentMutation(operationId, context: context) else { return false }

        let baseMembers = currentSession?.members ?? session.members
        var locallyUpdatedMembers = baseMembers.map { member in
            member.id == updated.id ? updated : member
        }
        if !locallyUpdatedMembers.contains(where: { $0.id == updated.id }) {
            locallyUpdatedMembers.append(updated)
        }
        sessionViewModel.applyUpdatedAuthorizedMember(updated, members: locallyUpdatedMembers)
        syncFromSessionViewModel()
        highlightMember(updated.id)
        return true
    }

    func applyMembers(_ members: [Member], basedOn session: AuthorizedSession) -> Bool {
        let refreshedCurrent = members.first(where: { $0.id == session.member.id }) ?? session.member
        let refreshedAuthenticated = members.first(where: { $0.id == session.authenticatedMember.id })
            ?? session.authenticatedMember
        let refreshedSession = AuthorizedSession(
            principal: session.principal,
            authenticatedMember: refreshedAuthenticated,
            member: refreshedCurrent,
            members: members,
            environment: session.environment
        )

        return adoptAuthorizedSession(
            refreshedSession,
            sourceMayContainPrivateMembers: canExposePrivateMemberData(in: session)
        )
    }

    func syncFromSessionViewModel() {
        guard case .authorized(let session) = sessionViewModel.mode else {
            resetState()
            return
        }
        let requiresDirectoryRefresh = adoptAuthorizedSession(
            session,
            sourceMayContainPrivateMembers: true
        )
        if requiresDirectoryRefresh {
            Task { await refreshMembers() }
        }
    }

    func resetState() {
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
        editorRevision += 1
        activeRefreshOperationId = nil
        activeMutationOperationId = nil
    }

    func showMemberMutationFailure(_ error: any Error) {
        guard let managementError = error as? MemberManagementError else {
            feedbackCenter.show(AccessL10nKey.feedbackUnableSaveChanges)
            return
        }
        switch managementError {
        case .accessDenied:
            feedbackCenter.show(AccessL10nKey.feedbackOnlyAdminManageMembers)
        case .lastAdminRemoval:
            feedbackCenter.show(AccessL10nKey.feedbackCannotRemoveLastAdmin)
        case .conflict:
            feedbackCenter.show(AccessL10nKey.feedbackUnableSaveChanges)
        }
    }

    func sortedMembers(from members: [Member]) -> [Member] {
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
