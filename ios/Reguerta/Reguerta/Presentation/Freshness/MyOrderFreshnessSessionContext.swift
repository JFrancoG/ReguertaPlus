struct MyOrderFreshnessMemberAuthorizationIdentity: Equatable {
    let id: String
    let authUID: String?
    let roles: Set<MemberRole>
    let isActive: Bool
    let capabilities: Set<AccessCapability>
}

extension MyOrderFreshnessMemberAuthorizationIdentity {
    init(member: Member) {
        id = member.id
        authUID = member.authUid
        roles = member.roles
        isActive = member.isActive
        capabilities = MemberPermissionMatrix.capabilities(for: member)
    }

    var canManageMembers: Bool {
        isActive && capabilities.contains(.manageMembers)
    }
}

/// Immutable authorization snapshot captured before a critical-data refresh can suspend.
struct MyOrderFreshnessSessionContext: Equatable {
    let principalUID: String
    let authenticatedMember: MyOrderFreshnessMemberAuthorizationIdentity
    let member: MyOrderFreshnessMemberAuthorizationIdentity
    let environment: SessionEnvironment
    let sessionStateRevision: UInt64
}

extension MyOrderFreshnessSessionContext {
    init(session: AuthorizedSession, sessionStateRevision: UInt64) {
        principalUID = session.principal.uid
        authenticatedMember = MyOrderFreshnessMemberAuthorizationIdentity(member: session.authenticatedMember)
        member = MyOrderFreshnessMemberAuthorizationIdentity(member: session.member)
        environment = session.environment
        self.sessionStateRevision = sessionStateRevision
    }

    var refreshScope: CriticalDataRefreshScope {
        CriticalDataRefreshScope(
            principalUID: principalUID,
            authenticatedMemberID: authenticatedMember.id,
            memberID: member.id,
            environment: environment,
            canManageMembers: authenticatedMember.canManageMembers
        )
    }

    var representsActiveAuthorization: Bool {
        authenticatedMember.authUID == principalUID &&
            authenticatedMember.isActive &&
            member.isActive &&
            (authenticatedMember.id == member.id || authenticatedMember.canManageMembers)
    }

    /// Compares authorization while deliberately ignoring the revision used to start the operation.
    ///
    /// Products uses this only after its synchronous, self-owned member refresh. The caller must
    /// still fence the operation generation and the revision of the resulting receipt.
    func matchesAuthorization(of session: AuthorizedSession) -> Bool {
        let current = MyOrderFreshnessSessionContext(
            session: session,
            sessionStateRevision: sessionStateRevision
        )
        return principalUID == current.principalUID &&
            authenticatedMember == current.authenticatedMember &&
            member == current.member &&
            environment == current.environment
    }
}
