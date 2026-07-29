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
    var sessionIdentityEpoch: UInt64 = 0
    @ObservationIgnored private var orderingRefreshGeneration: UInt64 = 0
    @ObservationIgnored private var appliedFreshnessOrderingGeneration: UInt64?
    @ObservationIgnored private var appliedFreshnessSessionRevision: UInt64?

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
        }
    ) {
        self.sessionViewModel = sessionViewModel
        self.feedbackCenter = feedbackCenter
        self.productRepository = productRepository
        self.memberRepository = memberRepository
        self.seasonalCommitmentRepository = seasonalCommitmentRepository
        self.imagePipelineManager = imagePipelineManager
        self.nowMillisProvider = nowMillisProvider
        self.productIDProvider = productIDProvider
    }
}

extension ProductsRouteViewModel {
    func handleSessionModeChange(_ mode: SessionMode) {
        switch mode {
        case .authorized(let session):
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
                Task { await refreshCatalog() }
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
        do {
            try await loadAndApplyOrderingState(
                context: context,
                refreshGeneration: refreshGeneration
            )
        } catch is CancellationError {
            if isCurrentOrderingRefresh(context, generation: refreshGeneration) {
                isLoadingOrderingProducts = false
            }
        } catch {
            if isCurrentOrderingRefresh(context, generation: refreshGeneration) {
                isLoadingOrderingProducts = false
                showUnableLoadFeedback()
            }
        }
    }

    func refreshOrderingProductsForFreshness(
        scope: CriticalDataRefreshScope,
        payload: CriticalDataRefreshPayload
    ) async throws {
        guard let context = authorizedSessionContext,
              context.matches(scope: scope)
        else {
            throw CancellationError()
        }

        let refreshGeneration = beginOrderingRefresh()
        isLoadingOrderingProducts = true
        do {
            try validateFreshnessPayload(
                payload,
                scope: scope,
                session: context.session
            )
            try await loadAndApplyOrderingState(
                context: context,
                refreshGeneration: refreshGeneration,
                prefetchedPayload: payload
            )
            guard isCurrentOrderingRefresh(context, generation: refreshGeneration) else {
                throw CancellationError()
            }
            appliedFreshnessOrderingGeneration = refreshGeneration
            appliedFreshnessSessionRevision = sessionViewModel.sessionStateRevision
        } catch is CancellationError {
            if Task.isCancelled || !isCurrentSession(context) {
                if isCurrentOrderingRefresh(context, generation: refreshGeneration) {
                    isLoadingOrderingProducts = false
                }
                throw CancellationError()
            }
            throw RepositoryError.unavailable(resource: "criticalData.orderingState.superseded")
        } catch {
            if isCurrentOrderingRefresh(context, generation: refreshGeneration) {
                isLoadingOrderingProducts = false
            }
            throw error
        }
    }

    func isOrderingStateCurrentForFreshness(scope: CriticalDataRefreshScope) -> Bool {
        guard let context = authorizedSessionContext,
              context.matches(scope: scope),
              let appliedFreshnessOrderingGeneration,
              let appliedFreshnessSessionRevision,
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
        case .authorized(let session):
            return session
        case .signedOut, .unauthorized:
            return nil
        }
    }

    var authorizedSessionContext: ProductsRouteSessionContext? {
        guard let session = authorizedSession else { return nil }
        return ProductsRouteSessionContext(
            session: session,
            generation: sessionIdentityEpoch
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
        guard let latestSession = authorizedSession else { return false }
        return sessionIdentityEpoch == context.generation &&
            latestSession.principal.uid == context.session.principal.uid &&
            latestSession.authenticatedMember.id == context.session.authenticatedMember.id &&
            latestSession.authenticatedMember.authUid == context.session.authenticatedMember.authUid &&
            latestSession.member.id == context.session.member.id &&
            latestSession.environment == context.session.environment &&
            latestSession.authenticatedMember.canManageMembers ==
                context.session.authenticatedMember.canManageMembers
    }
}

private extension ProductsRouteViewModel {
    private func reset() {
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
    }

    private func invalidateOperationsForIdentityChange() {
        invalidateOrderingRefresh()
        activeSaveOperationId = nil
        activeUploadOperationId = nil
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

    private func invalidateOrderingRefresh() {
        orderingRefreshGeneration &+= 1
        appliedFreshnessOrderingGeneration = nil
        appliedFreshnessSessionRevision = nil
    }

    private func isCurrentOrderingRefresh(
        _ context: ProductsRouteSessionContext,
        generation: UInt64
    ) -> Bool {
        generation == orderingRefreshGeneration && isCurrentSession(context)
    }

    private func loadAndApplyOrderingState(
        context: ProductsRouteSessionContext,
        refreshGeneration: UInt64,
        prefetchedPayload: CriticalDataRefreshPayload = CriticalDataRefreshPayload()
    ) async throws {
        let session = context.session
        let refreshedMembers = if let members = prefetchedPayload.members {
            members
        } else {
            try await memberRepository.members(visibleTo: session.authenticatedMember)
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
            try await loadSeasonalCommitments(for: refreshedCurrentMember)
        }
        async let products = if let products = prefetchedPayload.products {
            products
        } else {
            try await productRepository.allProducts()
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
        try Task.checkCancellation()
        guard isCurrentOrderingRefresh(context, generation: refreshGeneration) else {
            throw CancellationError()
        }

        sessionViewModel.applyRefreshedAuthorizedMembers(effectiveMembers)
        syncCurrentSessionFromSessionViewModel()
        guard isCurrentOrderingRefresh(context, generation: refreshGeneration) else {
            throw CancellationError()
        }
        myOrderProducts = visibleProducts
        myOrderSeasonalCommitments = resolvedCommitments
        hasLoadedOrderingProducts = true
        isLoadingOrderingProducts = false
    }

    private func mergeOrderingMembers(
        _ members: [Member],
        payload: CriticalDataRefreshPayload
    ) -> [Member] {
        var merged = members
        if let authenticatedMember = payload.authenticatedMember {
            merged = merged.filter { $0.id != authenticatedMember.id } + [authenticatedMember]
        }
        if let selectedMember = payload.selectedMember {
            merged = merged.filter { $0.id != selectedMember.id } + [selectedMember]
        }
        return merged
    }

    private func applyRefreshedIdentityPayload(
        _ payload: CriticalDataRefreshPayload,
        to session: AuthorizedSession
    ) {
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
                isLoadingOrderingProducts = false
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

    private func loadSeasonalCommitments(for member: Member) async throws -> [SeasonalCommitment] {
        var seasonalCommitmentsById: [String: SeasonalCommitment] = [:]
        let lookupKeys = member.seasonalCommitmentLookupKeys
        let commitmentRepository = seasonalCommitmentRepository
        let commitmentsByLookup = try await withThrowingTaskGroup(of: [SeasonalCommitment].self) { group in
            for lookupKey in lookupKeys {
                group.addTask {
                    try await commitmentRepository.activeCommitments(userId: lookupKey)
                }
            }
            var collected: [SeasonalCommitment] = []
            for try await commitments in group {
                collected.append(contentsOf: commitments)
            }
            return collected
        }
        for commitment in commitmentsByLookup {
            seasonalCommitmentsById[commitment.id] = commitment
        }
        return seasonalCommitmentsById.values.sorted { lhs, rhs in
            if lhs.seasonKey.localizedCaseInsensitiveCompare(rhs.seasonKey) != .orderedSame {
                return lhs.seasonKey.localizedCaseInsensitiveCompare(rhs.seasonKey) == .orderedAscending
            }
            return lhs.productId.localizedCaseInsensitiveCompare(rhs.productId) == .orderedAscending
        }
    }

    private func sortProductsForOrdering(lhs: Product, rhs: Product) -> Bool {
        if lhs.companyName.localizedCaseInsensitiveCompare(rhs.companyName) != .orderedSame {
            return lhs.companyName.localizedCaseInsensitiveCompare(rhs.companyName) == .orderedAscending
        }
        return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
    }

}
