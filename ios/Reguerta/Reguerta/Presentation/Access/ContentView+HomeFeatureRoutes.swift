import SwiftUI

extension ContentView {
    @ViewBuilder
    var shiftsRoute: some View {
        ShiftsRouteView(
            tokens: tokens,
            selectedShiftSegment: $selectedShiftSegment,
            isLoadingShifts: viewModel.isLoadingShifts,
            shiftsFeed: viewModel.shiftsFeed,
            shiftSwapRequests: viewModel.shiftSwapRequests,
            dismissedShiftSwapRequestIds: viewModel.dismissedShiftSwapRequestIds,
            currentMemberId: currentHomeMember?.id,
            currentSession: currentHomeSession,
            shiftSwapCopy: shiftSwapCopy,
            nextShiftsIsLoading: viewModel.isLoadingShifts,
            nextDeliverySummary: viewModel.nextDeliveryShift.map(shiftSummary) ?? l10n(AccessL10nKey.shiftsNextPending),
            nextMarketSummary: viewModel.nextMarketShift.map(shiftSummary) ?? l10n(AccessL10nKey.shiftsNextPending),
            onRefreshShifts: viewModel.refreshShifts,
            onRefreshFromNextShifts: {
                homeDestination = .shifts
                viewModel.refreshShifts()
            },
            onStartSwapRequestForShift: { shiftId in
                viewModel.startCreatingShiftSwap(shiftId: shiftId)
                homeDestination = .shiftSwapRequest
            },
            onAcceptIncomingCandidate: { requestId, candidateShiftId in
                viewModel.acceptShiftSwapRequest(requestId: requestId, candidateShiftId: candidateShiftId)
            },
            onRejectIncomingCandidate: { requestId, candidateShiftId in
                viewModel.rejectShiftSwapRequest(requestId: requestId, candidateShiftId: candidateShiftId)
            },
            onConfirmResponse: { requestId, candidateShiftId in
                viewModel.confirmShiftSwapRequest(requestId: requestId, candidateShiftId: candidateShiftId)
            },
            onCancelOwnRequest: { requestId in
                viewModel.cancelShiftSwapRequest(requestId: requestId)
            },
            onDismissAppliedRequest: { requestId in
                viewModel.dismissShiftSwapActivity(requestId: requestId)
            },
            shiftBoardLines: shiftLeftBoardLines,
            shiftSwapDisplayLabel: shiftSwapDisplayLabel,
            displayNameForSwap: displayNameForSwap,
            shiftSwapStatusLabel: shiftSwapStatusLabel,
            canRequestSwapForShift: canRequestSwapForShift
        )
    }

    var shiftSwapRequestRoute: some View {
        let shift = viewModel.shiftsFeed.first(where: { $0.id == viewModel.shiftSwapDraft.shiftId })
        let shiftDisplayLabel = shift.map {
            shiftSwapDisplayLabel($0, memberId: $0.assignedUserIds.first ?? $0.helperUserId)
        } ?? viewModel.shiftSwapDraft.shiftId

        return ShiftSwapRequestRouteView(
            tokens: tokens,
            shift: shift,
            shiftSwapDraftShiftId: viewModel.shiftSwapDraft.shiftId,
            shiftSwapReason: Binding(
                get: { viewModel.shiftSwapDraft.reason },
                set: { newValue in
                    viewModel.updateShiftSwapDraft { $0.reason = newValue }
                }
            ),
            isSavingShiftSwapRequest: viewModel.isSavingShiftSwapRequest,
            shiftSwapCopy: shiftSwapCopy,
            shiftDisplayLabel: shiftDisplayLabel,
            onSave: {
                viewModel.saveShiftSwapRequest {
                    homeDestination = .shifts
                }
            },
            onBack: {
                viewModel.clearShiftSwapDraft()
                homeDestination = .shifts
            }
        )
    }

    var newsListRoute: some View {
        NewsListRouteView(
            tokens: tokens,
            isLoadingNews: viewModel.isLoadingNews,
            newsFeed: viewModel.newsFeed,
            isAdmin: currentHomeMember?.isAdmin == true,
            newsMetaText: { article in
                l10n(AccessL10nKey.newsMetaFormat, article.publishedBy)
            },
            onCreateNews: {
                viewModel.startCreatingNews()
                homeDestination = .publishNews
            },
            onRefreshNews: viewModel.refreshNews,
            onEditNews: { newsId in
                viewModel.startEditingNews(newsId: newsId)
                homeDestination = .publishNews
            },
            onDeleteNews: { newsId in
                pendingNewsDeletionId = newsId
            }
        )
    }

    var newsEditorRoute: some View {
        NewsEditorRouteView(
            tokens: tokens,
            editingNewsId: viewModel.editingNewsId,
            newsTitle: newsTitleBinding,
            newsUrlImage: newsUrlImageBinding,
            newsBody: newsBodyBinding,
            newsActive: newsActiveBinding,
            isSavingNews: viewModel.isSavingNews,
            onSave: {
                viewModel.saveNews {
                    homeDestination = .news
                }
            },
            onBack: {
                viewModel.clearNewsEditor()
                homeDestination = .news
            }
        )
    }

    var productsRoute: some View {
        ProductsRouteView(
            tokens: tokens,
            viewModel: viewModel,
            currentHomeMember: currentHomeMember,
            pendingProducerCatalogVisibility: $pendingProducerCatalogVisibility
        )
    }

    var myOrderRoute: some View {
        MyOrderRouteView(
            tokens: tokens,
            products: viewModel.myOrderProductsFeed,
            seasonalCommitments: viewModel.myOrderSeasonalCommitmentsFeed,
            isLoading: viewModel.isLoadingMyOrderProducts,
            currentMember: currentHomeMember,
            members: currentHomeSession?.members ?? [],
            onRefresh: viewModel.refreshMyOrderProducts
        )
    }

    var notificationsListRoute: some View {
        NotificationsListRouteView(
            tokens: tokens,
            isLoadingNotifications: viewModel.isLoadingNotifications,
            notificationsFeed: viewModel.notificationsFeed,
            isAdmin: currentHomeMember?.isAdmin == true,
            notificationMetaText: { notification in
                l10n(
                    AccessL10nKey.notificationsMetaFormat,
                    localizedDateTime(notification.sentAtMillis)
                )
            },
            onCreateNotification: {
                viewModel.startCreatingNotification()
                homeDestination = .adminBroadcast
            },
            onRefreshNotifications: viewModel.refreshNotifications
        )
    }

    @ViewBuilder
    var sharedProfileRoute: some View {
        if let session = currentHomeSession {
            SharedProfileHubRoute(
                session: session,
                profiles: viewModel.sharedProfiles,
                draft: Binding(
                    get: { viewModel.sharedProfileDraft },
                    set: { viewModel.sharedProfileDraft = $0 }
                ),
                isLoading: viewModel.isLoadingSharedProfiles,
                isSaving: viewModel.isSavingSharedProfile,
                isDeleting: viewModel.isDeletingSharedProfile,
                onRefresh: viewModel.refreshSharedProfiles,
                onSave: viewModel.saveSharedProfile,
                onDelete: viewModel.deleteSharedProfile,
                displayName: { displayName(for: $0, session: session) }
            )
        }
    }

    var notificationEditorRoute: some View {
        NotificationEditorRouteView(
            tokens: tokens,
            notificationTitle: notificationTitleBinding,
            notificationBody: notificationBodyBinding,
            notificationAudience: notificationAudienceBinding,
            isSendingNotification: viewModel.isSendingNotification,
            onSend: {
                viewModel.sendNotification {
                    homeDestination = .notifications
                }
            },
            onBack: {
                viewModel.clearNotificationEditor()
                homeDestination = .notifications
            }
        )
    }

    @ViewBuilder
    var settingsRoute: some View {
        SettingsRouteView(
            tokens: tokens,
            session: currentHomeSession,
            isDevelopImpersonationEnabled: viewModel.isDevelopImpersonationEnabled,
            isImpersonationExpanded: $isImpersonationExpanded,
            isLoadingDeliveryCalendar: viewModel.isLoadingDeliveryCalendar,
            defaultDeliveryDayOfWeek: viewModel.defaultDeliveryDayOfWeek,
            shiftsFeed: viewModel.shiftsFeed,
            deliveryCalendarOverrides: viewModel.deliveryCalendarOverrides,
            isDeliveryCalendarEditorPresented: $isDeliveryCalendarEditorPresented,
            isDeliveryCalendarWeekPickerPresented: $isDeliveryCalendarWeekPickerPresented,
            selectedDeliveryCalendarWeekKey: $selectedDeliveryCalendarWeekKey,
            isSavingDeliveryCalendar: viewModel.isSavingDeliveryCalendar,
            isSubmittingShiftPlanningRequest: viewModel.isSubmittingShiftPlanningRequest,
            pendingShiftPlanningType: $pendingShiftPlanningType,
            onClearImpersonation: viewModel.clearImpersonation,
            onImpersonate: { memberId in
                viewModel.impersonate(memberId: memberId)
            },
            onRefreshDeliveryCalendar: viewModel.refreshDeliveryCalendar,
            onSaveDeliveryCalendarOverride: { weekKey, weekday, updatedByUserId in
                viewModel.saveDeliveryCalendarOverride(
                    weekKey: weekKey,
                    weekday: weekday,
                    updatedByUserId: updatedByUserId
                )
            },
            onDeleteDeliveryCalendarOverride: { weekKey in
                viewModel.deleteDeliveryCalendarOverride(weekKey: weekKey)
            },
            onSubmitShiftPlanningRequest: { type, completion in
                viewModel.submitShiftPlanningRequest(type: type, onSuccess: completion)
            }
        )
    }

    @ViewBuilder
    func placeholderRoute(titleKey: String, subtitleKey: String) -> some View {
        ReguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                Text(localizedKey(titleKey))
                    .font(tokens.typography.titleSection)
                Text(localizedKey(subtitleKey))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
                ReguertaButton(localizedKey(AccessL10nKey.commonBack)) {
                    homeDestination = .dashboard
                }
            }
        }
    }

    @ViewBuilder
    func cardContainer<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        content()
            .padding(tokens.spacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(tokens.colors.surfacePrimary)
            .overlay(
                RoundedRectangle(cornerRadius: tokens.radius.md)
                    .stroke(tokens.colors.borderSubtle, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: tokens.radius.md))
    }
}

private let myOrderCommonPurchasesGroupId = "__my_order_reguerta_common_purchases__"

private struct MyOrderProducerGroup: Identifiable {
    let vendorId: String
    let companyName: String
    let products: [Product]
    let hasCommonPurchase: Bool
    let isCommittedEcoBasketProducer: Bool
    let isCommonPurchasesGroup: Bool

    var id: String { vendorId }

    var sortPriority: Int {
        if isCommittedEcoBasketProducer { return 0 }
        if isCommonPurchasesGroup { return 1 }
        if hasCommonPurchase { return 2 }
        return 3
    }
}

private enum MyOrderCheckoutAlert: Identifiable {
    case missingCommitments([String])
    case ecoBasketPriceMismatch
    case readyToSubmit(total: Double, noPickupEcoBaskets: Int)

    var id: String {
        switch self {
        case .missingCommitments(let names):
            return "missing:\(names.joined(separator: ","))"
        case .ecoBasketPriceMismatch:
            return "ecoBasketPriceMismatch"
        case .readyToSubmit(let total, let noPickupEcoBaskets):
            return "ready:\(total):\(noPickupEcoBaskets)"
        }
    }
}

private struct MyOrderRouteView: View {
    let tokens: ReguertaDesignTokens
    let products: [Product]
    let seasonalCommitments: [SeasonalCommitment]
    let isLoading: Bool
    let currentMember: Member?
    let members: [Member]
    let onRefresh: () -> Void

    @State private var searchQuery = ""
    @State private var selectedQuantities: [String: Int] = [:]
    @State private var selectedEcoBasketOptions: [String: String] = [:]
    @State private var isCartVisible = false
    @State private var checkoutAlert: MyOrderCheckoutAlert?

    private var normalizedQuery: String {
        searchQuery.searchNormalized
    }

    private var currentWeekParity: ProducerParity {
        currentISOWeekProducerParity()
    }

    private var selectedProducts: [Product] {
        products.filter { selectedQuantities[$0.id, default: 0] > 0 }
    }

    private var selectedUnits: Int {
        selectedQuantities.values.reduce(0, +)
    }

    private var cartTotal: Double {
        selectedProducts.reduce(0) { partial, product in
            partial + Double(selectedQuantities[product.id, default: 0]) * product.price
        }
    }

    private var noPickupEcoBasketUnits: Int {
        countNoPickupEcoBasketUnits(
            products: products,
            selectedQuantities: selectedQuantities,
            selectedEcoBasketOptions: selectedEcoBasketOptions
        )
    }

    private var committedProducerId: String? {
        currentMember?.committedEcoBasketProducerId(in: members)
    }

    private var groupedProducts: [MyOrderProducerGroup] {
        let filteredProducts = products.filter { product in
            guard normalizedQuery.isNotEmpty else { return true }
            return product.matchesMyOrderSearch(normalizedQuery)
        }

        let commonPurchases = filteredProducts.filter(\.isCommonPurchase)
        let regularProducts = filteredProducts.filter { !$0.isCommonPurchase }

        var groups = Dictionary(grouping: regularProducts, by: \.vendorId)
            .map { vendorId, grouped in
                let sortedProducts = grouped.sorted { lhs, rhs in
                    if lhs.isEcoBasket != rhs.isEcoBasket {
                        return lhs.isEcoBasket && !rhs.isEcoBasket
                    }
                    return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
                }
                return MyOrderProducerGroup(
                    vendorId: vendorId,
                    companyName: grouped.first?.companyName ?? vendorId,
                    products: sortedProducts,
                    hasCommonPurchase: grouped.contains(where: \.isCommonPurchase),
                    isCommittedEcoBasketProducer: vendorId == committedProducerId && grouped.contains(where: \.isEcoBasket),
                    isCommonPurchasesGroup: false
                )
            }

        if !commonPurchases.isEmpty {
            groups.append(
                MyOrderProducerGroup(
                    vendorId: myOrderCommonPurchasesGroupId,
                    companyName: "Compras Regüerta",
                    products: commonPurchases.sorted { lhs, rhs in
                        lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
                    },
                    hasCommonPurchase: true,
                    isCommittedEcoBasketProducer: false,
                    isCommonPurchasesGroup: true
                )
            )
        }

        return groups.sorted { lhs, rhs in
            if lhs.sortPriority != rhs.sortPriority {
                return lhs.sortPriority < rhs.sortPriority
            }
            return lhs.companyName.localizedCaseInsensitiveCompare(rhs.companyName) == .orderedAscending
        }
    }

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .bottom) {
                VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                    headerRow
                    if isLoading {
                        loadingState
                    } else if groupedProducts.isEmpty {
                        emptyState
                    } else {
                        productsList
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

                if !isCartVisible {
                    searchOverlay
                }

                if isCartVisible {
                    Color.black.opacity(0.22)
                        .ignoresSafeArea()
                        .onTapGesture {
                            withAnimation(.easeInOut(duration: 0.22)) {
                                isCartVisible = false
                            }
                        }
                }

                cartOverlay(proxy: proxy)
            }
            .onChange(of: products) { _, newProducts in
                let productsById = Dictionary(uniqueKeysWithValues: newProducts.map { ($0.id, $0) })
                selectedQuantities = selectedQuantities.reduce(into: [:]) { partialResult, entry in
                    guard let product = productsById[entry.key] else { return }
                    guard entry.value > 0 else { return }
                    let allowedQuantity: Int
                    if let finiteLimit = finiteStockLimit(for: product) {
                        allowedQuantity = min(entry.value, finiteLimit)
                    } else {
                        allowedQuantity = entry.value
                    }
                    if allowedQuantity > 0 {
                        partialResult[entry.key] = allowedQuantity
                    }
                }
                selectedEcoBasketOptions = selectedQuantities.reduce(into: [:]) { partialResult, entry in
                    guard entry.value > 0 else { return }
                    guard let product = productsById[entry.key], product.isEcoBasket else { return }
                    let option = selectedEcoBasketOptions[entry.key]
                    if option == ecoBasketOptionPickup || option == ecoBasketOptionNoPickup {
                        partialResult[entry.key] = option
                    } else {
                        partialResult[entry.key] = ecoBasketOptionPickup
                    }
                }
                if selectedQuantities.isEmpty {
                    isCartVisible = false
                }
            }
            .alert(item: $checkoutAlert) { alert in
                switch alert {
                case .missingCommitments(let names):
                    return Alert(
                        title: Text("Faltan productos de compromiso"),
                        message: Text("Necesitas incluir al menos una unidad de: \(names.joined(separator: ", "))."),
                        dismissButton: .default(Text("Aceptar"))
                    )
                case .ecoBasketPriceMismatch:
                    return Alert(
                        title: Text("Precio de ecocesta inconsistente"),
                        message: Text("Todas las ecocestas activas deben mantener el mismo precio para continuar."),
                        dismissButton: .default(Text("Aceptar"))
                    )
                case .readyToSubmit(let total, let noPickupEcoBaskets):
                    return Alert(
                        title: Text("Pedido listo"),
                        message: Text(
                            noPickupEcoBaskets > 0
                                ? "Todo correcto. Total: \(total.myOrderUiDecimal) €. Ecocestas marcadas como no_pickup: \(noPickupEcoBaskets). En el siguiente paso conectamos el envío del pedido."
                                : "Todo correcto. Total: \(total.myOrderUiDecimal) €. En el siguiente paso conectamos el envío del pedido."
                        ),
                        dismissButton: .default(Text("Aceptar"))
                    )
                }
            }
        }
    }

    private var headerRow: some View {
        HStack(spacing: tokens.spacing.md) {
            VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                Text("Lista de productos")
                    .font(tokens.typography.titleCard)
                    .foregroundStyle(tokens.colors.textPrimary)
                Text("Agrupados por productor")
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
            }

            Spacer(minLength: tokens.spacing.sm)

            Button {
                withAnimation(.easeInOut(duration: 0.22)) {
                    isCartVisible = true
                }
            } label: {
                HStack(spacing: tokens.spacing.xs) {
                    Text("Ver")
                        .font(tokens.typography.body.weight(.semibold))
                    Image(systemName: "cart")
                        .font(.system(size: 16.resize, weight: .semibold))
                }
                .foregroundStyle(selectedUnits == 0 ? tokens.colors.textSecondary : tokens.colors.actionPrimary)
                .padding(.horizontal, tokens.spacing.md)
                .padding(.vertical, tokens.spacing.sm)
                .background(tokens.colors.surfacePrimary)
                .overlay(
                    RoundedRectangle(cornerRadius: tokens.radius.md)
                        .stroke(
                            selectedUnits == 0 ? tokens.colors.borderSubtle : tokens.colors.actionPrimary,
                            lineWidth: 1
                        )
                )
                .clipShape(RoundedRectangle(cornerRadius: tokens.radius.md))
            }
            .buttonStyle(.plain)
            .disabled(selectedUnits == 0)
        }
    }

    private var loadingState: some View {
        ReguertaCard {
            Text(LocalizedStringKey(AccessL10nKey.myOrderListLoading))
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.textSecondary)
        }
    }

    private var emptyState: some View {
        ReguertaCard {
            Text(LocalizedStringKey(AccessL10nKey.myOrderListEmpty))
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.textSecondary)
        }
    }

    private var productsList: some View {
        ScrollView(.vertical, showsIndicators: false) {
            LazyVStack(alignment: .leading, spacing: tokens.spacing.md, pinnedViews: [.sectionHeaders]) {
                ForEach(groupedProducts) { group in
                    Section {
                        VStack(spacing: tokens.spacing.md) {
                            ForEach(group.products) { product in
                                productCard(product)
                            }
                        }
                    } header: {
                        producerHeader(group)
                    }
                }
            }
            .padding(.top, tokens.spacing.xs)
            .padding(.bottom, 120.resize)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    @ViewBuilder
    private func producerHeader(_ group: MyOrderProducerGroup) -> some View {
        HStack(spacing: tokens.spacing.sm) {
            Text(group.companyName)
                .font(tokens.typography.titleCard.weight(.semibold))
                .foregroundStyle(tokens.colors.actionPrimary)
            if group.isCommittedEcoBasketProducer {
                badge("Compromiso ecocesta")
            }
            if group.isCommonPurchasesGroup {
                badge("Compra común")
            }
            Spacer()
        }
        .padding(.vertical, tokens.spacing.xs)
        .padding(.horizontal, tokens.spacing.xs)
        .background(tokens.colors.surfacePrimary.opacity(0.98))
    }

    @ViewBuilder
    private func productCard(_ product: Product) -> some View {
        let quantity = selectedQuantities[product.id, default: 0]
        let stockLabel = stockLabel(for: product)

        ReguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                HStack(alignment: .top, spacing: tokens.spacing.sm) {
                    productImage(product)

                    VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                        quantityControls(product: product, quantity: quantity)
                        Text(product.name)
                            .font(tokens.typography.body.weight(.semibold))
                            .foregroundStyle(tokens.colors.textPrimary)
                    }
                    Spacer(minLength: 0)
                }

                if product.description.isNotEmpty {
                    Text(product.description)
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)
                        .lineLimit(2)
                }

                Text(packContainerLine(for: product))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)

                HStack(alignment: .firstTextBaseline) {
                    Text("\(product.price.myOrderUiDecimal) € / ud.")
                        .font(tokens.typography.body.weight(.semibold))
                        .foregroundStyle(tokens.colors.textPrimary)
                    Spacer()
                    if let stockLabel {
                        Text(stockLabel)
                            .font(tokens.typography.bodySecondary.weight(.semibold))
                            .foregroundStyle(tokens.colors.actionPrimary)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func productImage(_ product: Product) -> some View {
        let imageSize = CGFloat(72.resize)
        if let imageURL = product.productImageUrl, let url = URL(string: imageURL), imageURL.isNotEmpty {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    Image("product_no_available")
                        .resizable()
                        .scaledToFill()
                }
            }
            .frame(width: imageSize, height: imageSize)
            .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))
        } else {
            Image("product_no_available")
                .resizable()
                .scaledToFill()
                .frame(width: imageSize, height: imageSize)
                .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))
        }
    }

    @ViewBuilder
    private func quantityControls(product: Product, quantity: Int) -> some View {
        if quantity == 0 {
            Button {
                increase(product)
            } label: {
                HStack(spacing: tokens.spacing.xs) {
                    Text("Añadir")
                        .font(tokens.typography.body.weight(.semibold))
                    Image(systemName: "cart.badge.plus")
                        .font(.system(size: 16.resize, weight: .semibold))
                }
                .foregroundStyle(tokens.colors.actionOnPrimary)
                .padding(.horizontal, tokens.spacing.md)
                .padding(.vertical, tokens.spacing.sm)
                .background(tokens.colors.actionPrimary)
                .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))
            }
            .buttonStyle(.plain)
            .disabled(!canIncrease(product: product, currentQuantity: quantity))
            .opacity(canIncrease(product: product, currentQuantity: quantity) ? 1 : 0.55)
        } else {
            HStack(spacing: tokens.spacing.sm) {
                Text("\(quantity) \(quantity == 1 ? "ud." : "uds.")")
                    .font(tokens.typography.body.weight(.semibold))
                    .foregroundStyle(tokens.colors.textPrimary)

                Button {
                    decrease(product)
                } label: {
                    Image(systemName: quantity == 1 ? "trash" : "minus")
                        .font(.system(size: 14.resize, weight: .bold))
                        .foregroundStyle(tokens.colors.actionOnPrimary)
                        .frame(width: 36.resize, height: 36.resize)
                        .background(Color(red: 0.74, green: 0.36, blue: 0.35))
                        .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))
                }
                .buttonStyle(.plain)

                Button {
                    increase(product)
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 15.resize, weight: .bold))
                        .foregroundStyle(tokens.colors.actionOnPrimary)
                        .frame(width: 36.resize, height: 36.resize)
                        .background(tokens.colors.actionPrimary)
                        .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))
                }
                .buttonStyle(.plain)
                .disabled(!canIncrease(product: product, currentQuantity: quantity))
                .opacity(canIncrease(product: product, currentQuantity: quantity) ? 1 : 0.55)
            }
        }
    }

    private var searchOverlay: some View {
        HStack(spacing: tokens.spacing.sm) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(tokens.colors.textSecondary)
            TextField("Buscar productos", text: $searchQuery)
                .font(tokens.typography.bodySecondary)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            if searchQuery.isNotEmpty {
                Button {
                    searchQuery = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(tokens.colors.textSecondary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, tokens.spacing.md)
        .padding(.vertical, tokens.spacing.sm)
        .background(tokens.colors.surfacePrimary)
        .overlay(
            RoundedRectangle(cornerRadius: tokens.radius.md)
                .stroke(tokens.colors.borderSubtle, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: tokens.radius.md))
        .padding(.horizontal, tokens.spacing.sm)
        .padding(.bottom, tokens.spacing.lg)
    }

    @ViewBuilder
    private func cartOverlay(proxy: GeometryProxy) -> some View {
        let panelWidth = min(max(proxy.size.width * 0.9, 300.resize), 420.resize)

        HStack {
            Spacer(minLength: 0)
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                Button {
                    withAnimation(.easeInOut(duration: 0.22)) {
                        isCartVisible = false
                    }
                } label: {
                    HStack(spacing: tokens.spacing.xs) {
                        Image(systemName: "basket")
                        Text("Seguir comprando")
                            .font(tokens.typography.body.weight(.semibold))
                    }
                    .foregroundStyle(tokens.colors.actionPrimary)
                    .padding(.horizontal, tokens.spacing.md)
                    .padding(.vertical, tokens.spacing.sm)
                    .overlay(
                        RoundedRectangle(cornerRadius: tokens.radius.md)
                            .stroke(tokens.colors.actionPrimary, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)

                HStack {
                    Text("Mi carrito")
                        .font(tokens.typography.titleCard)
                    Spacer()
                    Text("Total: \(cartTotal.myOrderUiDecimal) €")
                        .font(tokens.typography.titleCard.weight(.semibold))
                        .foregroundStyle(tokens.colors.actionPrimary)
                }

                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: tokens.spacing.sm) {
                        ForEach(selectedProducts) { product in
                            selectedProductCard(product)
                        }
                    }
                    .padding(.bottom, 116.resize)
                }

                Spacer(minLength: 0)
            }
            .padding(tokens.spacing.md)
            .frame(width: panelWidth)
            .frame(maxHeight: .infinity, alignment: .top)
            .background(tokens.colors.surfacePrimary)
            .overlay(alignment: .bottom) {
                HStack {
                    Button {
                        validateCheckout()
                    } label: {
                        Text("Finalizar compra")
                            .font(tokens.typography.body.weight(.semibold))
                            .foregroundStyle(tokens.colors.actionOnPrimary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, tokens.spacing.sm)
                            .background(tokens.colors.actionPrimary)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .disabled(selectedUnits == 0)
                    .opacity(selectedUnits == 0 ? 0.55 : 1)
                }
                .padding(tokens.spacing.md)
                .background(tokens.colors.surfacePrimary.opacity(0.95))
            }
            .offset(x: isCartVisible ? 0 : panelWidth + 24.resize)
            .animation(.easeInOut(duration: 0.22), value: isCartVisible)
        }
        .allowsHitTesting(isCartVisible)
    }

    @ViewBuilder
    private func selectedProductCard(_ product: Product) -> some View {
        let quantity = selectedQuantities[product.id, default: 0]
        let selectedOption = selectedEcoBasketOptions[product.id] ?? ecoBasketOptionPickup

        ReguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                HStack(alignment: .top, spacing: tokens.spacing.sm) {
                    productImage(product)
                    VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                        Text(product.name)
                            .font(tokens.typography.body.weight(.semibold))
                        Text("\(product.price.myOrderUiDecimal) € / ud.")
                            .font(tokens.typography.bodySecondary)
                            .foregroundStyle(tokens.colors.textSecondary)
                    }
                    Spacer(minLength: 0)
                }
                quantityControls(product: product, quantity: quantity)
                if product.isEcoBasket, quantity > 0 {
                    ecoBasketOptionSelector(
                        selectedOption: selectedOption,
                        onOptionSelected: { option in
                            selectedEcoBasketOptions[product.id] = option
                        }
                    )
                }
            }
        }
    }

    private func validateCheckout() {
        let validation = validateMyOrderCheckout(
            currentMember: currentMember,
            members: members,
            products: products,
            seasonalCommitments: seasonalCommitments,
            selectedQuantities: selectedQuantities,
            selectedEcoBasketOptions: selectedEcoBasketOptions,
            currentWeekParity: currentWeekParity
        )

        if validation.hasEcoBasketPriceMismatch {
            checkoutAlert = .ecoBasketPriceMismatch
            return
        }
        if !validation.missingCommitmentProductNames.isEmpty {
            checkoutAlert = .missingCommitments(validation.missingCommitmentProductNames)
            return
        }
        checkoutAlert = .readyToSubmit(
            total: cartTotal,
            noPickupEcoBaskets: noPickupEcoBasketUnits
        )
    }

    private func packContainerLine(for product: Product) -> String {
        if let packContainerName = product.packContainerName, packContainerName.isNotEmpty {
            let quantity = (product.packContainerQty ?? product.unitQty).myOrderUiDecimal
            let unit = product.packContainerAbbreviation ??
                product.packContainerPlural ??
                product.unitAbbreviation ??
                product.unitName
            return "\(packContainerName) \(quantity) \(unit)".trimmingCharacters(in: .whitespaces)
        }
        let fallbackUnit = product.unitQty == 1 ? product.unitName : product.unitPlural
        return "\(fallbackUnit) \(product.unitQty.myOrderUiDecimal)".trimmingCharacters(in: .whitespaces)
    }

    private func finiteStockLimit(for product: Product) -> Int? {
        guard product.stockMode == .finite else { return nil }
        let stock = max(0, product.stockQty ?? 0)
        return Int(stock.rounded(.down))
    }

    private func canIncrease(product: Product, currentQuantity: Int) -> Bool {
        guard let finiteLimit = finiteStockLimit(for: product) else { return true }
        return currentQuantity < finiteLimit
    }

    private func stockLabel(for product: Product) -> String? {
        guard product.stockMode == .finite else { return nil }
        let stock = max(0, product.stockQty ?? 0)
        guard stock < 20 else { return nil }
        return "Quedan: \(stock.myOrderUiDecimal) uds."
    }

    private func increase(_ product: Product) {
        let currentQuantity = selectedQuantities[product.id, default: 0]
        guard canIncrease(product: product, currentQuantity: currentQuantity) else { return }
        selectedQuantities[product.id] = currentQuantity + 1
        if product.isEcoBasket, selectedEcoBasketOptions[product.id] == nil {
            selectedEcoBasketOptions[product.id] = ecoBasketOptionPickup
        }
    }

    private func decrease(_ product: Product) {
        let currentQuantity = selectedQuantities[product.id, default: 0]
        guard currentQuantity > 0 else { return }
        if currentQuantity == 1 {
            selectedQuantities.removeValue(forKey: product.id)
            if product.isEcoBasket {
                selectedEcoBasketOptions.removeValue(forKey: product.id)
            }
        } else {
            selectedQuantities[product.id] = currentQuantity - 1
        }
        if selectedQuantities.isEmpty {
            isCartVisible = false
        }
    }

    @ViewBuilder
    private func ecoBasketOptionSelector(
        selectedOption: String,
        onOptionSelected: @escaping (String) -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: tokens.spacing.xs) {
            Text("Opción ecocesta")
                .font(tokens.typography.label.weight(.semibold))
                .foregroundStyle(tokens.colors.textPrimary)

            HStack(spacing: tokens.spacing.sm) {
                ecoBasketOptionButton(
                    title: "Recoger",
                    isSelected: selectedOption == ecoBasketOptionPickup,
                    onTap: { onOptionSelected(ecoBasketOptionPickup) }
                )
                ecoBasketOptionButton(
                    title: "No recoger",
                    isSelected: selectedOption == ecoBasketOptionNoPickup,
                    onTap: { onOptionSelected(ecoBasketOptionNoPickup) }
                )
            }
        }
    }

    @ViewBuilder
    private func ecoBasketOptionButton(
        title: String,
        isSelected: Bool,
        onTap: @escaping () -> Void
    ) -> some View {
        Button(action: onTap) {
            Text(title)
                .font(tokens.typography.bodySecondary.weight(.semibold))
                .foregroundStyle(isSelected ? tokens.colors.actionPrimary : tokens.colors.textSecondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, tokens.spacing.xs)
                .background(
                    RoundedRectangle(cornerRadius: tokens.radius.sm)
                        .fill(
                            isSelected
                                ? tokens.colors.actionPrimary.opacity(0.14)
                                : tokens.colors.surfacePrimary
                        )
                )
                .overlay(
                    RoundedRectangle(cornerRadius: tokens.radius.sm)
                        .stroke(
                            isSelected
                                ? tokens.colors.actionPrimary
                                : tokens.colors.borderSubtle,
                            lineWidth: 1
                        )
                )
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func badge(_ title: String) -> some View {
        Text(title)
            .font(tokens.typography.label)
            .foregroundStyle(tokens.colors.actionPrimary)
            .padding(.horizontal, tokens.spacing.sm)
            .padding(.vertical, tokens.spacing.xs)
            .background(tokens.colors.actionPrimary.opacity(0.12))
            .clipShape(Capsule())
    }
}

private extension Double {
    var myOrderUiDecimal: String {
        if truncatingRemainder(dividingBy: 1) == 0 {
            return String(Int(self))
        }
        return String(format: "%.2f", self)
    }
}

private func countNoPickupEcoBasketUnits(
    products: [Product],
    selectedQuantities: [String: Int],
    selectedEcoBasketOptions: [String: String]
) -> Int {
    products
        .filter(\.isEcoBasket)
        .reduce(0) { partial, product in
            if selectedEcoBasketOptions[product.id] == ecoBasketOptionNoPickup {
                return partial + selectedQuantities[product.id, default: 0]
            }
            return partial
        }
}

private extension Product {
    func matchesMyOrderSearch(_ normalizedQuery: String) -> Bool {
        guard normalizedQuery.isNotEmpty else { return true }
        return name.searchNormalized.contains(normalizedQuery) ||
            description.searchNormalized.contains(normalizedQuery) ||
            companyName.searchNormalized.contains(normalizedQuery)
    }
}

private extension String {
    var searchNormalized: String {
        folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var isNotEmpty: Bool {
        !isEmpty
    }
}

private extension Member {
    func committedEcoBasketProducerId(in members: [Member]) -> String? {
        guard let parity = ecoCommitmentParity else {
            return nil
        }
        return members.first { producer in
            producer.id != id &&
                producer.roles.contains(.producer) &&
                producer.isActive &&
                producer.producerCatalogEnabled &&
                producer.producerParity == parity
        }?.id
    }
}
