extension ProductsRouteViewModel {
    private var authorizedSession: AuthorizedSession? {
        switch sessionViewModel.mode {
        case .authorized(let session) where session.representsActiveAuthorization:
            return session
        case .authorized, .signedOut, .unauthorized:
            return nil
        }
    }

    /// Returns a context only after Products has adopted the exact live session revision.
    ///
    /// This fails closed while the shared session changes ahead of the root mode-change handler, so catalog state or
    /// an editor owned by the previous authorization cannot start reads, uploads, or writes in the successor scope.
    var authorizedSessionContext: ProductsRouteSessionContext? {
        guard let session = authorizedSession,
              currentSession == session,
              currentMember == session.member,
              synchronizedSessionStateRevision == sessionViewModel.sessionStateRevision else {
            return nil
        }
        return ProductsRouteSessionContext(
            session: session,
            generation: sessionIdentityEpoch,
            sessionStateRevision: sessionViewModel.sessionStateRevision
        )
    }

    /// Adopts a session after composition or the root mode-change handler has invalidated any previous owner.
    func adoptCurrentSessionOwner(_ session: AuthorizedSession) {
        guard authorizedSession == session else {
            synchronizedSessionStateRevision = nil
            return
        }
        currentSession = session
        currentMember = session.member
        synchronizedSessionStateRevision = sessionViewModel.sessionStateRevision
    }

    /// Adopts the revision produced synchronously by a Products-owned member refresh.
    ///
    /// The predecessor context must still be the synchronized owner. Identity and environment remain exact.
    /// The selected member may change only for the validated server-demotion path that ends impersonation.
    @discardableResult
    func syncCurrentSessionFromSessionViewModel(
        from context: ProductsRouteSessionContext,
        allowsSelectedMemberReplacement: Bool = false
    ) -> Bool {
        guard currentSession == context.session,
              currentMember == context.session.member,
              synchronizedSessionStateRevision == context.sessionStateRevision,
              sessionIdentityEpoch == context.generation,
              let session = authorizedSession,
              hasSameSessionLineage(
                  context.session,
                  session,
                  allowsSelectedMemberReplacement: allowsSelectedMemberReplacement
              ) else {
            return false
        }
        if allowsSelectedMemberReplacement {
            invalidateProductsSessionOwner()
        }
        resetOrderingProductsIfSessionChanged(to: session)
        currentSession = session
        currentMember = session.member
        synchronizedSessionStateRevision = sessionViewModel.sessionStateRevision
        return true
    }

    func isCurrentSession(_ context: ProductsRouteSessionContext) -> Bool {
        guard context.session.representsActiveAuthorization,
              let latestContext = authorizedSessionContext else {
            return false
        }
        return latestContext.session == context.session &&
            latestContext.generation == context.generation &&
            latestContext.sessionStateRevision == context.sessionStateRevision
    }

    func resetOrderingProductsIfSessionChanged(to session: AuthorizedSession) {
        guard let currentSession, !hasSameSessionLineage(currentSession, session) else { return }
        myOrderProducts = []
        myOrderSeasonalCommitments = []
        hasLoadedOrderingProducts = false
        isLoadingOrderingProducts = false
    }

    private func hasSameSessionLineage(
        _ lhs: AuthorizedSession,
        _ rhs: AuthorizedSession,
        allowsSelectedMemberReplacement: Bool = false
    ) -> Bool {
        lhs.principal.uid == rhs.principal.uid &&
            lhs.authenticatedMember.id == rhs.authenticatedMember.id &&
            lhs.authenticatedMember.authUid == rhs.authenticatedMember.authUid &&
            (allowsSelectedMemberReplacement || lhs.member.id == rhs.member.id) &&
            lhs.environment == rhs.environment
    }
}
