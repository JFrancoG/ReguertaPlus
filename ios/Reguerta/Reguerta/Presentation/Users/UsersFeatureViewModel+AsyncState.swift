import Foundation

extension UsersFeatureViewModel {
    var authorizedSessionContext: SessionContext? {
        guard let currentSession,
              currentSession.representsActiveAuthorization,
              case .authorized(let liveSession) = sessionViewModel.mode,
              liveSession.representsActiveAuthorization else { return nil }
        let currentSignature = authorizationSignature(for: currentSession)
        let liveSignature = authorizationSignature(for: liveSession)
        guard currentSignature == liveSignature else { return nil }
        return SessionContext(session: currentSession, generation: sessionIdentityEpoch)
    }

    func isCurrentSession(_ context: SessionContext) -> Bool {
        guard context.session.representsActiveAuthorization,
              let currentSession,
              currentSession.representsActiveAuthorization,
              case .authorized(let liveSession) = sessionViewModel.mode,
              liveSession.representsActiveAuthorization else { return false }
        let expectedSignature = authorizationSignature(for: context.session)
        return authorizationSignature(for: currentSession) == expectedSignature &&
            authorizationSignature(for: liveSession) == expectedSignature &&
            sessionIdentityEpoch == context.generation
    }

    func isCurrentMutation(_ operationId: UInt64, context: SessionContext) -> Bool {
        activeMutationOperationId == operationId && isCurrentSession(context)
    }

    func beginMutation(kind: MemberMutationKind) -> UInt64 {
        nextMutationOperationId += 1
        activeMutationOperationId = nextMutationOperationId
        switch kind {
        case .save:
            isSavingMember = true
        case .toggle:
            isTogglingMember = true
        }
        return nextMutationOperationId
    }

    func finishMutation(_ operationId: UInt64) {
        guard activeMutationOperationId == operationId else { return }
        activeMutationOperationId = nil
        isSavingMember = false
        isTogglingMember = false
    }

    func beginRefreshOperation() -> UInt64 {
        nextRefreshOperationId += 1
        activeRefreshOperationId = nextRefreshOperationId
        isLoadingMembers = true
        return nextRefreshOperationId
    }

    func isCurrentRefresh(_ operationId: UInt64, context: SessionContext) -> Bool {
        activeRefreshOperationId == operationId && isCurrentSession(context)
    }

    func finishRefreshOperation(_ operationId: UInt64) {
        guard activeRefreshOperationId == operationId else { return }
        activeRefreshOperationId = nil
        isLoadingMembers = false
    }

    @discardableResult
    func adoptAuthorizedSession(
        _ incomingSession: AuthorizedSession,
        sourceMayContainPrivateMembers: Bool
    ) -> Bool {
        let previousSession = currentSession
        let authorizationChanged = previousSession.map {
            authorizationSignature(for: $0) != authorizationSignature(for: incomingSession)
        } ?? true
        let lostPrivateAccess = previousSession.map(canExposePrivateMemberData(in:)) == true &&
            !canExposePrivateMemberData(in: incomingSession)
        let requiresDirectoryRefresh = !canExposePrivateMemberData(in: incomingSession) &&
            (sourceMayContainPrivateMembers || lostPrivateAccess)
        let adoptedSession = requiresDirectoryRefresh
            ? publicSessionProjection(incomingSession)
            : incomingSession

        if authorizationChanged {
            sessionIdentityEpoch += 1
            invalidateAsyncOperations()
            cancelMemberHighlight()
            clearEditor()
            pendingToggleActiveMemberId = nil
        }
        currentSession = adoptedSession
        currentMember = adoptedSession.member
        membersFeed = adoptedSession.members.sorted {
            $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending
        }
        if sessionViewModel.mode != .authorized(adoptedSession) {
            sessionViewModel.mode = .authorized(adoptedSession)
        }
        return requiresDirectoryRefresh
    }

    func invalidateAsyncOperations() {
        activeRefreshOperationId = nil
        activeMutationOperationId = nil
        isLoadingMembers = false
        isSavingMember = false
        isTogglingMember = false
    }

    func cancelMemberHighlight() {
        memberHighlightTask?.cancel()
        memberHighlightTask = nil
        highlightedMemberId = nil
    }

    func canExposePrivateMemberData(in session: AuthorizedSession) -> Bool {
        session.member.isActive &&
            session.authenticatedMember.isActive &&
            session.member.canManageMembers &&
            session.authenticatedMember.canManageMembers &&
            session.authenticatedMember.authUid == session.principal.uid
    }

    func publicSessionProjection(_ session: AuthorizedSession) -> AuthorizedSession {
        let hasReciprocalAuthLink = session.authenticatedMember.authUid == session.principal.uid
        let publicAuthenticatedMember = hasReciprocalAuthLink
            ? session.authenticatedMember
            : session.authenticatedMember.publicDirectoryProjection()
        let publicCurrentMember = session.member.id == session.authenticatedMember.id && hasReciprocalAuthLink
            ? publicAuthenticatedMember
            : session.member.publicDirectoryProjection()
        let publicMembers = session.members.map { member in
            member.id == session.authenticatedMember.id && hasReciprocalAuthLink
                ? publicAuthenticatedMember
                : member.publicDirectoryProjection()
        }

        return AuthorizedSession(
            principal: session.principal,
            authenticatedMember: publicAuthenticatedMember,
            member: publicCurrentMember,
            members: publicMembers,
            environment: session.environment
        )
    }

    func authorizationSignature(for session: AuthorizedSession) -> SessionAuthorizationSignature {
        SessionAuthorizationSignature(
            environment: session.environment,
            principalUid: session.principal.uid,
            authenticatedMemberId: session.authenticatedMember.id,
            authenticatedMemberAuthUid: session.authenticatedMember.authUid,
            authenticatedMemberRoles: session.authenticatedMember.roles,
            authenticatedMemberIsActive: session.authenticatedMember.isActive,
            memberId: session.member.id,
            memberAuthUid: session.member.authUid,
            memberRoles: session.member.roles,
            memberIsActive: session.member.isActive
        )
    }
}

extension UsersFeatureViewModel {
    struct SessionContext {
        let session: AuthorizedSession
        let generation: UInt64
    }

    struct SessionAuthorizationSignature: Equatable {
        let environment: SessionEnvironment
        let principalUid: String
        let authenticatedMemberId: String
        let authenticatedMemberAuthUid: String?
        let authenticatedMemberRoles: Set<MemberRole>
        let authenticatedMemberIsActive: Bool
        let memberId: String
        let memberAuthUid: String?
        let memberRoles: Set<MemberRole>
        let memberIsActive: Bool
    }

    enum MemberMutationKind {
        case save
        case toggle
    }
}

private extension Member {
    func publicDirectoryProjection() -> Member {
        Member(
            id: id,
            displayName: displayName,
            companyName: companyName,
            normalizedEmail: "",
            authUid: nil,
            roles: roles,
            isActive: isActive,
            producerCatalogEnabled: producerCatalogEnabled,
            isCommonPurchaseManager: isCommonPurchaseManager,
            producerParity: producerParity,
            ecoCommitmentMode: ecoCommitmentMode,
            ecoCommitmentParity: ecoCommitmentParity
        )
    }
}
