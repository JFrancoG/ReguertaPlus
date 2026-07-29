struct ProductsRouteSessionContext {
    let session: AuthorizedSession
    let generation: UInt64

    func matches(scope: CriticalDataRefreshScope) -> Bool {
        session.principal.uid == scope.principalUID &&
            session.authenticatedMember.id == scope.authenticatedMemberID &&
            session.authenticatedMember.authUid == scope.principalUID &&
            session.member.id == scope.memberID &&
            session.environment == scope.environment &&
            session.authenticatedMember.canManageMembers == scope.canManageMembers
    }
}
