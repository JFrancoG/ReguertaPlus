import Foundation

struct ProductsOrderingStateApplication {
    let members: [Member]
    let products: [Product]
    let commitments: [SeasonalCommitment]
    let sessionContext: ProductsRouteSessionContext
    let refreshGeneration: UInt64
    let freshnessContext: MyOrderFreshnessSessionContext?
}

extension ProductsRouteViewModel {
    func applyOrderingState(_ application: ProductsOrderingStateApplication) throws -> ProductsRouteSessionContext {
        try Task.checkCancellation()
        guard isCurrentOrderingRefresh(
            application.sessionContext,
            generation: application.refreshGeneration
        ) else {
            throw CancellationError()
        }

        sessionViewModel.applyRefreshedAuthorizedMembers(application.members)
        syncCurrentSessionFromSessionViewModel()
        guard let appliedContext = authorizedSessionContext,
              appliedContext.generation == application.sessionContext.generation,
              appliedContext.session.principal.uid == application.sessionContext.session.principal.uid,
              appliedContext.session.authenticatedMember.id ==
                  application.sessionContext.session.authenticatedMember.id,
              appliedContext.session.member.id == application.sessionContext.session.member.id,
              appliedContext.session.environment == application.sessionContext.session.environment,
              application.freshnessContext.map({
                  appliedContext.matchesAuthorization(freshnessContext: $0)
              }) != false,
              isCurrentOrderingRefresh(appliedContext, generation: application.refreshGeneration) else {
            throw CancellationError()
        }
        myOrderProducts = application.products
        myOrderSeasonalCommitments = application.commitments
        hasLoadedOrderingProducts = true
        return appliedContext
    }
}
