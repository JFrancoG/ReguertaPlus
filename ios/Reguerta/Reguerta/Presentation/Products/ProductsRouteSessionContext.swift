struct ProductsRouteSessionContext {
    let session: AuthorizedSession
    let generation: UInt64
    let sessionStateRevision: UInt64

    /// Requires the exact authorization identity and session revision captured before freshness began.
    func matches(freshnessContext: MyOrderFreshnessSessionContext) -> Bool {
        sessionStateRevision == freshnessContext.sessionStateRevision &&
            matchesAuthorization(freshnessContext: freshnessContext)
    }

    /// Allows only the authorization-equivalent handoff produced synchronously by this owner.
    func matchesAuthorization(freshnessContext: MyOrderFreshnessSessionContext) -> Bool {
        freshnessContext.representsActiveAuthorization &&
            freshnessContext.matchesAuthorization(of: session)
    }
}
