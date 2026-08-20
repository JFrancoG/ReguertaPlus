import Foundation
import Observation

@MainActor
@Observable
final class ProductsRouteViewModel {
    @ObservationIgnored let sessionViewModel: SessionViewModel
    @ObservationIgnored let feedbackCenter: GlobalFeedbackCenter
    @ObservationIgnored let productRepository: any ProductRepository
    @ObservationIgnored let memberRepository: any MemberRepository
    @ObservationIgnored let seasonalCommitmentRepository: any SeasonalCommitmentRepository
    @ObservationIgnored let imagePipelineManager: any ImagePipelineManager
    @ObservationIgnored let nowMillisProvider: @MainActor () -> Int64
    @ObservationIgnored let productIDProvider: @MainActor () -> String
    @ObservationIgnored let productHighlightClock: PresentationDelayClock
    @ObservationIgnored var productHighlightTask: Task<Void, Never>?
    var currentSession: AuthorizedSession?
    var currentMember: Member?
    var catalogProducts: [Product] = []
    var myOrderProducts: [Product] = []
    var myOrderSeasonalCommitments: [SeasonalCommitment] = []
    var draft = ProductDraft()
    var editingProductId: String?
    var isLoadingCatalog = false
    var isLoadingOrderingProducts = false
    var hasLoadedOrderingProducts = false
    var isSaving = false
    var isUploadingImage = false
    var isUpdatingCatalogVisibility = false
    var highlightedProductId: String?
    var pendingNewProductId: String?
    var editorRevision: UInt64 = 0
    var activeSaveOperationId: UInt64?
    var nextSaveOperationId: UInt64 = 0
    var activeUploadOperationId: UInt64?
    var nextUploadOperationId: UInt64 = 0
    var activeCatalogVisibilityOperationId: UInt64?
    var nextCatalogVisibilityOperationId: UInt64 = 0
    var sessionIdentityEpoch: UInt64 = 0
    @ObservationIgnored var catalogRefreshGeneration: UInt64 = 0
    @ObservationIgnored private var orderingRefreshGeneration: UInt64 = 0
    @ObservationIgnored private var appliedFreshnessOrderingGeneration: UInt64?
    @ObservationIgnored private var appliedFreshnessSessionRevision: UInt64?
    @ObservationIgnored private var appliedFreshnessContext: MyOrderFreshnessSessionContext?
    var activeProducts: [Product] {
        catalogProducts.filter { !$0.archived }
    }

    var archivedProducts: [Product] {
        catalogProducts.filter(\.archived)
    }

    var isEditing: Bool {
        editingProductId != nil
    }

    var isProducer: Bool {
        currentMember?.isProducer == true
    }

    var canManageEcoBasket: Bool {
        isProducer && currentMember?.producerParity != nil
    }

    var canManageCommonPurchase: Bool {
        currentMember?.isCommonPurchaseManager == true && !isProducer
    }

    init(
        sessionViewModel: SessionViewModel,
        feedbackCenter: GlobalFeedbackCenter = GlobalFeedbackCenter(),
        productRepository: any ProductRepository,
        memberRepository: any MemberRepository,
        seasonalCommitmentRepository: any SeasonalCommitmentRepository,
        imagePipelineManager: any ImagePipelineManager,
        nowMillisProvider: @escaping @MainActor () -> Int64,
        productIDProvider: @escaping @MainActor () -> String = {
            UUID().uuidString.lowercased()
        },
        productHighlightClock: PresentationDelayClock = .continuous
    ) {
        self.sessionViewModel = sessionViewModel
        self.feedbackCenter = feedbackCenter
        self.productRepository = productRepository
        self.memberRepository = memberRepository
        self.seasonalCommitmentRepository = seasonalCommitmentRepository
        self.imagePipelineManager = imagePipelineManager
        self.nowMillisProvider = nowMillisProvider
        self.productIDProvider = productIDProvider
        self.productHighlightClock = productHighlightClock
    }
}

extension ProductsRouteViewModel {
    func handleSessionModeChange(_ mode: SessionMode) {
        switch mode {
        case .authorized(let session):
            guard session.representsActiveAuthorization else {
                sessionIdentityEpoch += 1
                reset()
                return
            }
            let identityChanged = currentSession?.principal.uid != session.principal.uid ||
                currentSession?.authenticatedMember.id != session.authenticatedMember.id ||
                currentSession?.authenticatedMember.authUid != session.authenticatedMember.authUid ||
                currentSession?.member.id != session.member.id ||
                currentSession?.environment != session.environment ||
                currentSession?.authenticatedMember.canManageMembers !=
                    session.authenticatedMember.canManageMembers
            let catalogAccessRevoked = currentMember?.canManageProductCatalog == true &&
                !session.member.canManageProductCatalog
            let shouldInvalidateEditor = identityChanged || catalogAccessRevoked
            if shouldInvalidateEditor {
                sessionIdentityEpoch += 1
                invalidateOperationsForIdentityChange()
            }
            resetOrderingProductsIfSessionChanged(to: session)
            currentSession = session
            currentMember = session.member
            if shouldInvalidateEditor {
                clearEditor()
            }
            if session.member.canManageProductCatalog {
                Task { await refreshCatalog(recoversInitialFailure: true) }
            } else {
                catalogProducts = []
            }
        case .signedOut, .unauthorized:
            sessionIdentityEpoch += 1
            reset()
        }
    }

    func handleNowOverrideChange() {
        guard currentSession != nil else { return }
        Task { await refreshOrderingProducts() }
    }

    func refreshOrderingProducts() async {
        guard let context = authorizedSessionContext else {
            invalidateOrderingRefresh()
            myOrderProducts = []
            myOrderSeasonalCommitments = []
            isLoadingOrderingProducts = false
            hasLoadedOrderingProducts = false
            return
        }
        let refreshGeneration = beginOrderingRefresh()
        isLoadingOrderingProducts = true
        defer { finishOrderingRefresh(refreshGeneration) }
        do {
            _ = try await loadAndApplyOrderingState(
                context: context,
                refreshGeneration: refreshGeneration
            )
        } catch is CancellationError {
            return
        } catch {
            if isCurrentOrderingRefresh(context, generation: refreshGeneration) {
                showUnableLoadFeedback()
            }
        }
    }

    func refreshOrderingProductsForFreshness(
        context freshnessContext: MyOrderFreshnessSessionContext,
        payload: CriticalDataRefreshPayload
    ) async throws {
        guard let context = authorizedSessionContext,
              context.matches(freshnessContext: freshnessContext)
        else {
            throw CancellationError()
        }

        let refreshGeneration = beginOrderingRefresh()
        isLoadingOrderingProducts = true
        defer { finishOrderingRefresh(refreshGeneration) }
        do {
            try validateFreshnessPayload(
                payload,
                scope: freshnessContext.refreshScope,
                session: context.session
            )
            let appliedContext = try await loadAndApplyOrderingState(
                context: context,
                refreshGeneration: refreshGeneration,
                prefetchedPayload: payload,
                freshnessContext: freshnessContext
            )
            guard isCurrentOrderingRefresh(appliedContext, generation: refreshGeneration) else {
                throw CancellationError()
            }
            appliedFreshnessOrderingGeneration = refreshGeneration
            appliedFreshnessSessionRevision = sessionViewModel.sessionStateRevision
            appliedFreshnessContext = freshnessContext
        } catch is CancellationError {
            if Task.isCancelled || !isCurrentSession(context) {
                throw CancellationError()
            }
            throw RepositoryError.unavailable(resource: "criticalData.orderingState.superseded")
        } catch {
            throw error
        }
    }

    func isOrderingStateCurrentForFreshness(context freshnessContext: MyOrderFreshnessSessionContext) -> Bool {
        guard let context = authorizedSessionContext,
              context.matchesAuthorization(freshnessContext: freshnessContext),
              let appliedFreshnessOrderingGeneration,
              let appliedFreshnessSessionRevision,
              appliedFreshnessContext == freshnessContext,
              appliedFreshnessSessionRevision == sessionViewModel.sessionStateRevision
        else {
            return false
        }
        return isCurrentOrderingRefresh(
            context,
            generation: appliedFreshnessOrderingGeneration
        )
    }
}

extension ProductsRouteViewModel {
    private var authorizedSession: AuthorizedSession? {
        switch sessionViewModel.mode {
        case .authorized(let session) where session.representsActiveAuthorization:
            return session
        case .authorized, .signedOut, .unauthorized:
            return nil
        }
    }

    var authorizedSessionContext: ProductsRouteSessionContext? {
        guard let session = authorizedSession else { return nil }
        return ProductsRouteSessionContext(
            session: session,
            generation: sessionIdentityEpoch,
            sessionStateRevision: sessionViewModel.sessionStateRevision
        )
    }

    func syncCurrentSessionFromSessionViewModel() {
        guard let session = authorizedSession else {
            reset()
            return
        }
        resetOrderingProductsIfSessionChanged(to: session)
        currentSession = session
        currentMember = session.member
    }

    func isCurrentSession(_ context: ProductsRouteSessionContext) -> Bool {
        guard context.session.representsActiveAuthorization, let latestSession = authorizedSession else { return false }
        return sessionViewModel.sessionStateRevision == context.sessionStateRevision &&
            sessionIdentityEpoch == context.generation &&
            latestSession.principal.uid == context.session.principal.uid &&
            latestSession.authenticatedMember.id == context.session.authenticatedMember.id &&
            latestSession.authenticatedMember.authUid == context.session.authenticatedMember.authUid &&
            latestSession.member.id == context.session.member.id &&
            latestSession.environment == context.session.environment &&
            latestSession.authenticatedMember.canManageMembers ==
                context.session.authenticatedMember.canManageMembers
    }

    func beginCatalogRefresh() -> UInt64 {
        catalogRefreshGeneration &+= 1
        return catalogRefreshGeneration
    }

    func finishCatalogRefresh(_ generation: UInt64) {
        guard catalogRefreshGeneration == generation else { return }
        isLoadingCatalog = false
    }

    func isCurrentCatalogRefresh(_ context: ProductsRouteSessionContext, generation: UInt64) -> Bool {
        generation == catalogRefreshGeneration && isCurrentSession(context)
    }

    func isCurrentOrderingRefresh(_ context: ProductsRouteSessionContext, generation: UInt64) -> Bool {
        generation == orderingRefreshGeneration && isCurrentSession(context)
    }
}

private extension ProductsRouteViewModel {
    private func reset() {
        cancelProductHighlight()
        catalogRefreshGeneration &+= 1
        invalidateOrderingRefresh()
        currentSession = nil
        currentMember = nil
        catalogProducts = []
        myOrderProducts = []
        myOrderSeasonalCommitments = []
        hasLoadedOrderingProducts = false
        draft = ProductDraft()
        editingProductId = nil
        isLoadingCatalog = false
        isLoadingOrderingProducts = false
        isSaving = false
        isUploadingImage = false
        isUpdatingCatalogVisibility = false
        highlightedProductId = nil
        pendingNewProductId = nil
        editorRevision += 1
        activeSaveOperationId = nil
        activeUploadOperationId = nil
        activeCatalogVisibilityOperationId = nil
    }

    private func invalidateOperationsForIdentityChange() {
        cancelProductHighlight()
        catalogRefreshGeneration &+= 1
        invalidateOrderingRefresh()
        activeSaveOperationId = nil
        activeUploadOperationId = nil
        activeCatalogVisibilityOperationId = nil
        isSaving = false
        isUploadingImage = false
        isUpdatingCatalogVisibility = false
        isLoadingCatalog = false
        isLoadingOrderingProducts = false
        catalogProducts = []
        highlightedProductId = nil
    }

    private func resetOrderingProductsIfSessionChanged(to session: AuthorizedSession) {
        guard let currentSession else { return }
        guard currentSession.principal.uid != session.principal.uid ||
            currentSession.authenticatedMember.id != session.authenticatedMember.id ||
            currentSession.authenticatedMember.authUid != session.authenticatedMember.authUid ||
            currentSession.member.id != session.member.id ||
            currentSession.environment != session.environment ||
            currentSession.authenticatedMember.canManageMembers !=
                session.authenticatedMember.canManageMembers else {
            return
        }
        myOrderProducts = []
        myOrderSeasonalCommitments = []
        hasLoadedOrderingProducts = false
        isLoadingOrderingProducts = false
    }

    private func beginOrderingRefresh() -> UInt64 {
        orderingRefreshGeneration &+= 1
        return orderingRefreshGeneration
    }

    private func finishOrderingRefresh(_ generation: UInt64) {
        guard orderingRefreshGeneration == generation else { return }
        isLoadingOrderingProducts = false
    }

    private func invalidateOrderingRefresh() {
        orderingRefreshGeneration &+= 1
        appliedFreshnessOrderingGeneration = nil
        appliedFreshnessSessionRevision = nil
        appliedFreshnessContext = nil
    }

    private func loadAndApplyOrderingState(
        context: ProductsRouteSessionContext,
        refreshGeneration: UInt64,
        prefetchedPayload: CriticalDataRefreshPayload = CriticalDataRefreshPayload(),
        freshnessContext: MyOrderFreshnessSessionContext? = nil
    ) async throws -> ProductsRouteSessionContext {
        let session = context.session
        let environment = session.environment
        let refreshedMembers = if let members = prefetchedPayload.members {
            members
        } else {
            try await memberRepository.members(visibleTo: session.authenticatedMember, environment: environment)
        }
        let effectiveMembers = mergeOrderingMembers(
            refreshedMembers.isEmpty ? session.members : refreshedMembers,
            payload: prefetchedPayload
        )
        let membersById = Dictionary(uniqueKeysWithValues: effectiveMembers.map { ($0.id, $0) })
        let refreshedCurrentMember = prefetchedPayload.selectedMember ??
            membersById[session.member.id] ?? session.member
        let currentWeekParity = producerParityForISOWeek(nowMillis: nowMillisProvider())

        async let commitments = if let commitments = prefetchedPayload.seasonalCommitments {
            commitments
        } else {
            try await loadSeasonalCommitments(for: refreshedCurrentMember, environment: environment)
        }
        async let products = if let products = prefetchedPayload.products {
            products
        } else {
            try await productRepository.allProducts(environment: environment)
        }
        let visibleProducts = try await products
            .filter { product in
                product.isVisibleInOrdering &&
                    membersById[product.vendorId].isVisibleForOrdering &&
                    product.matchesCurrentProducerWeek(
                        membersById: membersById,
                        currentWeekParity: currentWeekParity
                    )
            }
            .sorted(by: sortProductsForOrdering)
        let resolvedCommitments = try await commitments
        return try applyOrderingState(ProductsOrderingStateApplication(
            members: effectiveMembers,
            products: visibleProducts,
            commitments: resolvedCommitments,
            sessionContext: context,
            refreshGeneration: refreshGeneration,
            freshnessContext: freshnessContext
        ))
    }

    private func mergeOrderingMembers(_ members: [Member], payload: CriticalDataRefreshPayload) -> [Member] {
        var merged = members
        if let authenticatedMember = payload.authenticatedMember {
            if let index = merged.firstIndex(where: { $0.id == authenticatedMember.id }) {
                merged[index] = authenticatedMember
            } else {
                merged.append(authenticatedMember)
            }
        }
        if let selectedMember = payload.selectedMember {
            if let index = merged.firstIndex(where: { $0.id == selectedMember.id }) {
                merged[index] = selectedMember
            } else {
                merged.append(selectedMember)
            }
        }
        return merged
    }

    private func applyRefreshedIdentityPayload(_ payload: CriticalDataRefreshPayload, to session: AuthorizedSession) {
        if let authenticatedMember = payload.authenticatedMember,
           session.authenticatedMember.canManageMembers,
           !authenticatedMember.canManageMembers {
            sessionViewModel.applyRefreshedAuthorizedMembers([authenticatedMember])
            syncCurrentSessionFromSessionViewModel()
            return
        }
        var membersByID = Dictionary(uniqueKeysWithValues: session.members.map { ($0.id, $0) })
        if let authenticatedMember = payload.authenticatedMember {
            membersByID[authenticatedMember.id] = authenticatedMember
        }
        if let selectedMember = payload.selectedMember {
            membersByID[selectedMember.id] = selectedMember
        }
        sessionViewModel.applyRefreshedAuthorizedMembers(Array(membersByID.values))
        syncCurrentSessionFromSessionViewModel()
    }

    private func validateFreshnessPayload(
        _ payload: CriticalDataRefreshPayload,
        scope: CriticalDataRefreshScope,
        session: AuthorizedSession
    ) throws {
        if let authenticatedMember = payload.authenticatedMember {
            guard authenticatedMember.id == scope.authenticatedMemberID,
                  authenticatedMember.authUid == scope.principalUID,
                  authenticatedMember.isActive else {
                throw RepositoryError.permissionDenied(
                    resource: "criticalData.orderingState.authenticatedMemberLink"
                )
            }
            if authenticatedMember.canManageMembers != scope.canManageMembers {
                applyRefreshedIdentityPayload(payload, to: session)
                throw RepositoryError.unavailable(
                    resource: "criticalData.orderingState.accessScopeChanged"
                )
            }
        }
        if let selectedMember = payload.selectedMember {
            guard selectedMember.id == scope.memberID, selectedMember.isActive else {
                throw RepositoryError.permissionDenied(
                    resource: "criticalData.orderingState.selectedMember"
                )
            }
        }
    }

    private func loadSeasonalCommitments(
        for member: Member,
        environment: SessionEnvironment
    ) async throws -> [SeasonalCommitment] {
        let commitmentRepository = seasonalCommitmentRepository
        return try await loadActiveCommitments(for: member) { lookupKey in
            try await commitmentRepository.activeCommitments(
                userId: lookupKey,
                environment: environment
            )
        }
    }

    private func sortProductsForOrdering(lhs: Product, rhs: Product) -> Bool {
        if lhs.companyName.localizedCaseInsensitiveCompare(rhs.companyName) != .orderedSame {
            return lhs.companyName.localizedCaseInsensitiveCompare(rhs.companyName) == .orderedAscending
        }
        return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
    }

}
