import FirebaseFirestore
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
            shifts: viewModel.shiftsFeed,
            defaultDeliveryDayOfWeek: viewModel.defaultDeliveryDayOfWeek,
            deliveryCalendarOverrides: viewModel.deliveryCalendarOverrides,
            nowMillis: viewModel.nowOverrideMillis ?? Int64(Date().timeIntervalSince1970 * 1_000),
            isLoading: viewModel.isLoadingMyOrderProducts,
            currentMember: currentHomeMember,
            members: currentHomeSession?.members ?? [],
            onRefresh: viewModel.refreshMyOrderProducts,
            onCheckoutSuccessAcknowledge: {
                homeDestination = .dashboard
            }
        )
    }

    var receivedOrdersRoute: some View {
        ReceivedOrdersRouteView(
            tokens: tokens,
            currentMember: currentHomeMember,
            shifts: viewModel.shiftsFeed,
            defaultDeliveryDayOfWeek: viewModel.defaultDeliveryDayOfWeek,
            deliveryCalendarOverrides: viewModel.deliveryCalendarOverrides,
            nowMillis: viewModel.nowOverrideMillis ?? Int64(Date().timeIntervalSince1970 * 1_000)
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
            nowOverrideMillis: viewModel.nowOverrideMillis,
            onClearImpersonation: viewModel.clearImpersonation,
            onImpersonate: { memberId in
                viewModel.impersonate(memberId: memberId)
            },
            onSetNowOverrideMillis: viewModel.setNowOverrideMillis,
            onShiftNowByDays: viewModel.shiftNowByDays,
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

private enum ReceivedOrdersTab: String, CaseIterable, Identifiable {
    case byProduct
    case byMember

    var id: String { rawValue }

    var title: String {
        switch self {
        case .byProduct:
            return "Por producto"
        case .byMember:
            return "Por regüertense"
        }
    }
}

private enum ProducerOrderStatus: String, CaseIterable {
    case unread
    case read
    case prepared
    case delivered

    static func from(_ rawValue: String?) -> ProducerOrderStatus {
        guard let rawValue else { return .unread }
        return ProducerOrderStatus(rawValue: rawValue.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()) ?? .unread
    }

    var title: String {
        switch self {
        case .unread: return "Pendiente"
        case .read: return "Pendiente"
        case .prepared: return "Preparado"
        case .delivered: return "Entregado"
        }
    }
}

private struct ProducerStatusVisualStyle {
    let container: Color
    let border: Color
}

private enum ReceivedOrdersLoadState {
    case idle
    case loading
    case loaded(ReceivedOrdersSnapshot)
    case empty
    case error
}

private struct ReceivedOrdersWindow {
    let isEnabled: Bool
    let targetWeekKey: String
}

private struct ReceivedOrderLineRecord: Identifiable {
    let id: String
    let orderId: String
    let consumerId: String
    let consumerDisplayName: String
    let productId: String
    let productName: String
    let productImageUrl: String?
    let companyName: String
    let packagingLine: String
    let quantity: Double
    let quantityUnitSingular: String
    let quantityUnitPlural: String
    let subtotal: Double

    var dedupKey: String {
        "\(orderId)|\(consumerId)|\(productId)"
    }
}

private struct ReceivedOrdersProductRow: Identifiable {
    let productId: String
    let productName: String
    let productImageUrl: String?
    let companyName: String
    let packagingLine: String
    let totalQuantity: Double
    let quantityUnitSingular: String
    let quantityUnitPlural: String

    var id: String { productId }

    func quantityUnitLabel() -> String {
        receivedOrdersIsApproximatelyOne(totalQuantity) ? quantityUnitSingular : quantityUnitPlural
    }
}

private struct ReceivedOrdersMemberLine: Identifiable {
    let id: String
    let productName: String
    let packagingLine: String
    let quantity: Double
    let quantityUnitSingular: String
    let quantityUnitPlural: String
    let subtotal: Double

    func quantityUnitLabel() -> String {
        receivedOrdersIsApproximatelyOne(quantity) ? quantityUnitSingular : quantityUnitPlural
    }
}

private struct ReceivedOrdersMemberGroup: Identifiable {
    let id: String
    let orderId: String
    let consumerDisplayName: String
    let producerStatus: ProducerOrderStatus
    let lines: [ReceivedOrdersMemberLine]
    let total: Double
}

private struct ReceivedOrdersSnapshot {
    let byProductRows: [ReceivedOrdersProductRow]
    let byMemberGroups: [ReceivedOrdersMemberGroup]
    let generalTotal: Double
}

private struct ReceivedOrdersRouteView: View {
    let tokens: ReguertaDesignTokens
    let currentMember: Member?
    let shifts: [ShiftAssignment]
    let defaultDeliveryDayOfWeek: DeliveryWeekday?
    let deliveryCalendarOverrides: [DeliveryCalendarOverride]
    let nowMillis: Int64

    @State private var selectedTab: ReceivedOrdersTab = .byProduct
    @State private var loadState: ReceivedOrdersLoadState = .idle
    @State private var updatingStatusOrderId: String?

    private var isProducer: Bool {
        currentMember?.roles.contains(.producer) == true
    }

    private var window: ReceivedOrdersWindow {
        resolveReceivedOrdersWindow(
            nowMillis: nowMillis,
            defaultDeliveryDayOfWeek: defaultDeliveryDayOfWeek,
            deliveryCalendarOverrides: deliveryCalendarOverrides,
            shifts: shifts
        )
    }

    private var loadTaskID: String {
        "\(isProducer)-\(window.isEnabled)-\(window.targetWeekKey)-\(currentMember?.id ?? "")"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.md) {
            Text("Pedidos a preparar")
                .font(tokens.typography.titleSection)
                .foregroundStyle(tokens.colors.textPrimary)

            tabSelector

            routeContent
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .task(id: loadTaskID) {
            await loadIfNeeded()
        }
    }

    @ViewBuilder
    private var tabSelector: some View {
        HStack(spacing: tokens.spacing.xs) {
            ForEach(ReceivedOrdersTab.allCases) { tab in
                Button {
                    selectedTab = tab
                } label: {
                    Text(tab.title)
                        .font(tokens.typography.bodySecondary.weight(.semibold))
                        .foregroundStyle(tokens.colors.textPrimary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, tokens.spacing.sm)
                        .background(
                            selectedTab == tab ?
                            tokens.colors.surfacePrimary :
                                Color.clear
                        )
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(tokens.spacing.xs)
        .background(tokens.colors.surfaceSecondary.opacity(0.72))
        .clipShape(Capsule())
    }

    @ViewBuilder
    private var routeContent: some View {
        if !isProducer {
            infoCard(
                title: "Solo para productores",
                body: "Esta sección aparece cuando accedes con un perfil productor."
            )
        } else if !window.isEnabled {
            infoCard(
                title: "Pedidos fuera de ventana",
                body: "La pantalla de preparación se habilita entre lunes y día de reparto."
            )
        } else {
            switch loadState {
            case .idle, .loading:
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            case .empty:
                infoCard(
                    title: "Sin pedidos recibidos",
                    body: "No hay líneas de pedido para preparar en la semana \(window.targetWeekKey)."
                )
            case .error:
                ReguertaCard {
                    VStack(alignment: .leading, spacing: tokens.spacing.md) {
                        Text("No se pudieron cargar los pedidos")
                            .font(tokens.typography.titleCard.weight(.semibold))
                            .foregroundStyle(tokens.colors.feedbackError)
                        Text("Revisa la conexión y vuelve a intentarlo.")
                            .font(tokens.typography.bodySecondary)
                            .foregroundStyle(tokens.colors.textSecondary)
                        ReguertaButton("Reintentar") {
                            Task {
                                await loadIfNeeded(force: true)
                            }
                        }
                    }
                }
            case .loaded(let snapshot):
                loadedContent(snapshot)
            }
        }
    }

    @ViewBuilder
    private func loadedContent(_ snapshot: ReceivedOrdersSnapshot) -> some View {
        ScrollView(.vertical, showsIndicators: false) {
            LazyVStack(alignment: .leading, spacing: tokens.spacing.md) {
                if selectedTab == .byProduct {
                    ForEach(snapshot.byProductRows) { row in
                        productCard(row)
                    }
                } else {
                    ForEach(snapshot.byMemberGroups) { group in
                        memberCard(
                            group,
                            isUpdatingStatus: updatingStatusOrderId == group.orderId,
                            onSelectStatus: { status in
                                guard updatingStatusOrderId == nil else { return }
                                guard group.producerStatus != status else { return }
                                guard let producerId = currentMember?.id, !producerId.isEmpty else { return }
                                Task { @MainActor in
                                    updatingStatusOrderId = group.orderId
                                    let updated = await updateReceivedOrderProducerStatus(
                                        orderId: group.orderId,
                                        producerId: producerId,
                                        status: status
                                    )
                                    if updated, case .loaded(let currentSnapshot) = loadState {
                                        loadState = .loaded(
                                            currentSnapshot.withProducerStatus(orderId: group.orderId, status: status)
                                        )
                                    }
                                    updatingStatusOrderId = nil
                                }
                            }
                        )
                    }
                }
            }
            .padding(.bottom, 106.resize)
        }
        .safeAreaInset(edge: .bottom, spacing: tokens.spacing.xs) {
            totalBar(total: snapshot.generalTotal)
        }
    }

    @ViewBuilder
    private func productCard(_ row: ReceivedOrdersProductRow) -> some View {
        ReguertaCard {
            HStack(alignment: .center, spacing: tokens.spacing.md) {
                receivedOrdersProductImage(urlString: row.productImageUrl)

                VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                    Text(row.productName)
                        .font(tokens.typography.titleCard.weight(.semibold))
                        .foregroundStyle(tokens.colors.actionPrimary)
                    Text(row.packagingLine)
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)
                        .lineLimit(2)
                }

                Spacer(minLength: 0)

                VStack(alignment: .trailing, spacing: tokens.spacing.xs) {
                    Text(row.totalQuantity.myOrderUiDecimal)
                        .font(tokens.typography.titleCard.weight(.bold))
                        .foregroundStyle(tokens.colors.textPrimary)
                    Text(row.quantityUnitLabel())
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)
                }
            }
        }
    }

    @ViewBuilder
    private func memberCard(
        _ group: ReceivedOrdersMemberGroup,
        isUpdatingStatus: Bool,
        onSelectStatus: @escaping (ProducerOrderStatus) -> Void
    ) -> some View {
        let style = group.producerStatus.visualStyle
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            HStack(spacing: tokens.spacing.sm) {
                Text(group.consumerDisplayName)
                    .font(tokens.typography.titleCard.weight(.semibold))
                    .foregroundStyle(tokens.colors.actionPrimary)
                    .frame(maxWidth: .infinity, alignment: .center)
                Text(group.producerStatus.title)
                    .font(tokens.typography.label.weight(.semibold))
                    .foregroundStyle(tokens.colors.textSecondary)
            }

            producerStatusSelector(
                selectedStatus: group.producerStatus,
                isUpdatingStatus: isUpdatingStatus,
                onSelectStatus: onSelectStatus
            )

            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                ForEach(group.lines) { line in
                    VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                        HStack(alignment: .top, spacing: tokens.spacing.md) {
                            VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                                Text(line.productName)
                                    .font(tokens.typography.body.weight(.semibold))
                                    .foregroundStyle(tokens.colors.textPrimary)
                                Text(line.packagingLine)
                                    .font(tokens.typography.bodySecondary)
                                    .foregroundStyle(tokens.colors.textSecondary)
                            }
                            Spacer(minLength: 0)
                            VStack(alignment: .trailing, spacing: tokens.spacing.xs) {
                                Text(line.quantity.myOrderUiDecimal)
                                    .font(tokens.typography.body.weight(.semibold))
                                    .foregroundStyle(tokens.colors.textPrimary)
                                Text(line.quantityUnitLabel())
                                    .font(tokens.typography.bodySecondary)
                                    .foregroundStyle(tokens.colors.textSecondary)
                                Text("\(line.subtotal.myOrderUiDecimal) €")
                                    .font(tokens.typography.body.weight(.semibold))
                                    .foregroundStyle(tokens.colors.textPrimary)
                            }
                        }
                    }

                    if line.id != group.lines.last?.id {
                        Divider()
                            .overlay(tokens.colors.borderSubtle.opacity(0.6))
                    }
                }

                Divider()
                    .overlay(tokens.colors.borderSubtle.opacity(0.8))

                Text("Total: \(group.total.myOrderUiDecimal) €")
                    .font(tokens.typography.titleCard.weight(.semibold))
                    .foregroundStyle(tokens.colors.feedbackError)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
        .padding(tokens.spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(style.container)
        .overlay(
            RoundedRectangle(cornerRadius: tokens.radius.md)
                .stroke(style.border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: tokens.radius.md))
    }

    @ViewBuilder
    private func producerStatusSelector(
        selectedStatus: ProducerOrderStatus,
        isUpdatingStatus: Bool,
        onSelectStatus: @escaping (ProducerOrderStatus) -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: tokens.spacing.xs) {
            Text("Estado productor")
                .font(tokens.typography.bodySecondary.weight(.semibold))
                .foregroundStyle(tokens.colors.textSecondary)
            Text(selectedStatus.title)
                .font(tokens.typography.body.weight(.semibold))
                .foregroundStyle(tokens.colors.textPrimary)
            if selectedStatus != .delivered {
                let isPrepared = selectedStatus == .prepared
                let targetStatus: ProducerOrderStatus = isPrepared ? .read : .prepared
                Button {
                    onSelectStatus(targetStatus)
                } label: {
                    Text(isPrepared ? "Marcar pendiente" : "Marcar preparado")
                        .font(tokens.typography.bodySecondary.weight(.semibold))
                        .foregroundStyle(tokens.colors.textPrimary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, tokens.spacing.xs)
                        .background(tokens.colors.actionPrimary.opacity(0.14))
                        .overlay(
                            RoundedRectangle(cornerRadius: tokens.radius.sm)
                                .stroke(tokens.colors.actionPrimary, lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))
                }
                .buttonStyle(.plain)
                .disabled(isUpdatingStatus)
            }
            if isUpdatingStatus {
                Text("Guardando estado…")
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
            }
        }
    }

    @ViewBuilder
    private func totalBar(total: Double) -> some View {
        HStack {
            Text("Suma total general: \(total.myOrderUiDecimal) €")
                .font(tokens.typography.titleCard.weight(.semibold))
                .foregroundStyle(tokens.colors.textPrimary)
                .frame(maxWidth: .infinity, alignment: .center)
        }
        .padding(.vertical, tokens.spacing.md)
        .padding(.horizontal, tokens.spacing.lg)
        .background(tokens.colors.actionPrimary.opacity(0.34))
        .clipShape(RoundedRectangle(cornerRadius: tokens.radius.md))
    }

    @ViewBuilder
    private func infoCard(title: String, body: String) -> some View {
        ReguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(title)
                    .font(tokens.typography.titleCard.weight(.semibold))
                    .foregroundStyle(tokens.colors.textPrimary)
                Text(body)
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
            }
        }
    }

    @ViewBuilder
    private func receivedOrdersProductImage(urlString: String?) -> some View {
        let imageSize = CGFloat(64.resize)
        if let urlString, let url = URL(string: urlString), urlString.isNotEmpty {
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

    @MainActor
    private func loadIfNeeded(force: Bool = false) async {
        guard isProducer else {
            loadState = .idle
            return
        }
        guard window.isEnabled else {
            loadState = .idle
            return
        }
        if !force, case .loading = loadState {
            return
        }
        guard let producerId = currentMember?.id else {
            loadState = .error
            return
        }
        loadState = .loading
        do {
            if let snapshot = try await fetchReceivedOrdersSnapshotForProducer(
                producerId: producerId,
                targetWeekKey: window.targetWeekKey
            ) {
                loadState = .loaded(snapshot)
            } else {
                loadState = .empty
            }
        } catch {
            loadState = .error
        }
    }
}

private func resolveReceivedOrdersWindow(
    nowMillis: Int64,
    defaultDeliveryDayOfWeek: DeliveryWeekday?,
    deliveryCalendarOverrides: [DeliveryCalendarOverride],
    shifts: [ShiftAssignment]
) -> ReceivedOrdersWindow {
    let consultaWindow = resolveMyOrderConsultaWindow(
        defaultDeliveryDayOfWeek: defaultDeliveryDayOfWeek,
        deliveryCalendarOverrides: deliveryCalendarOverrides,
        shifts: shifts,
        now: Date(timeIntervalSince1970: TimeInterval(nowMillis) / 1_000)
    )
    let currentWeekKey = nowMillis.isoWeekKey
    return ReceivedOrdersWindow(
        isEnabled: consultaWindow.isConsultaPhase,
        targetWeekKey: consultaWindow.isConsultaPhase ? consultaWindow.previousWeekKey : currentWeekKey
    )
}

private func fetchReceivedOrdersSnapshotForProducer(
    producerId: String,
    targetWeekKey: String,
    db: Firestore = Firestore.firestore(),
    environment: ReguertaFirestoreEnvironment = ReguertaRuntimeEnvironment.currentFirestoreEnvironment
) async throws -> ReceivedOrdersSnapshot? {
    let firestorePath = ReguertaFirestorePath(environment: environment)
    let readTargets = Array(Set([
        firestorePath.collectionPath(.orderlines),
        "\(environment.rawValue)/collections/orderLines",
        "\(environment.rawValue)/collections/orderlines"
    ]))
    var dedupedLinesByKey: [String: ReceivedOrderLineRecord] = [:]
    var hasSuccessfulRead = false
    var lastError: Error?

    for orderlinesPath in readTargets {
        do {
            let snapshot = try await db.collection(orderlinesPath)
                .whereField("vendorId", isEqualTo: producerId)
                .whereField("weekKey", isEqualTo: targetWeekKey)
                .getDocuments()
            hasSuccessfulRead = true
            for document in snapshot.documents {
                if let line = receivedOrderLineRecord(
                    from: document.data(),
                    fallbackDocumentID: document.documentID
                ) {
                    dedupedLinesByKey[line.dedupKey] = line
                }
            }
        } catch {
            lastError = error
        }
    }

    if !hasSuccessfulRead, let lastError {
        throw lastError
    }

    let lines = dedupedLinesByKey.values.sorted { lhs, rhs in
        if lhs.consumerDisplayName != rhs.consumerDisplayName {
            return lhs.consumerDisplayName.localizedCaseInsensitiveCompare(rhs.consumerDisplayName) == .orderedAscending
        }
        return lhs.productName.localizedCaseInsensitiveCompare(rhs.productName) == .orderedAscending
    }
    guard !lines.isEmpty else { return nil }
    var statusesByOrderId = try await fetchReceivedOrderStatusesByOrderId(
        orderIds: lines.map(\.orderId),
        producerId: producerId,
        db: db,
        environment: environment
    )
    let unreadOrderIds = statusesByOrderId
        .filter { $0.value == .unread }
        .map(\.key)
    if !unreadOrderIds.isEmpty {
        let markedAsRead = await markReceivedOrdersAsRead(
            orderIds: unreadOrderIds,
            producerId: producerId,
            db: db,
            environment: environment
        )
        if !markedAsRead.isEmpty {
            for orderId in markedAsRead {
                statusesByOrderId[orderId] = .read
            }
        }
    }
    return buildReceivedOrdersSnapshot(from: lines, statusesByOrderId: statusesByOrderId)
}

private func fetchReceivedOrderStatusesByOrderId(
    orderIds: [String],
    producerId: String,
    db: Firestore = Firestore.firestore(),
    environment: ReguertaFirestoreEnvironment = ReguertaRuntimeEnvironment.currentFirestoreEnvironment
) async throws -> [String: ProducerOrderStatus] {
    let dedupedOrderIds = Array(Set(orderIds)).filter(\.isNotEmpty)
    guard !dedupedOrderIds.isEmpty else { return [:] }

    let firestorePath = ReguertaFirestorePath(environment: environment)
    let readTargets = Array(Set([
        firestorePath.collectionPath(.orders),
        "\(environment.rawValue)/collections/orders"
    ]))
    var statusesByOrderId: [String: ProducerOrderStatus] = [:]
    var hasSuccessfulRead = false
    var lastError: Error?

    for ordersPath in readTargets {
        for chunk in dedupedOrderIds.chunked(into: 10) {
            do {
                let snapshot = try await db.collection(ordersPath)
                    .whereField(FieldPath.documentID(), in: chunk)
                    .getDocuments()
                hasSuccessfulRead = true
                for document in snapshot.documents {
                    statusesByOrderId[document.documentID] = receivedOrderStatus(
                        from: document.data(),
                        producerId: producerId
                    )
                }
            } catch {
                lastError = error
            }
        }
    }

    if !hasSuccessfulRead, let lastError {
        throw lastError
    }
    return statusesByOrderId
}

private func updateReceivedOrderProducerStatus(
    orderId: String,
    producerId: String,
    status: ProducerOrderStatus,
    db: Firestore = Firestore.firestore(),
    environment: ReguertaFirestoreEnvironment = ReguertaRuntimeEnvironment.currentFirestoreEnvironment,
    nowMillis: Int64 = Int64(Date().timeIntervalSince1970 * 1_000)
) async -> Bool {
    let firestorePath = ReguertaFirestorePath(environment: environment)
    let writeTargets = Array(Set([
        firestorePath.collectionPath(.orders),
        "\(environment.rawValue)/collections/orders"
    ]))
    let nowTimestamp = Timestamp(date: Date(timeIntervalSince1970: TimeInterval(nowMillis) / 1_000))

    for ordersPath in writeTargets {
        do {
            let orderRef = db.document("\(ordersPath)/\(orderId)")
            try await orderRef.updateData([
                "producerStatus": status.rawValue,
                "producerStatusesByVendor.\(producerId)": status.rawValue,
                "updatedAt": nowTimestamp
            ])
            return true
        } catch {
            continue
        }
    }

    return false
}

private func markReceivedOrdersAsRead(
    orderIds: [String],
    producerId: String,
    db: Firestore = Firestore.firestore(),
    environment: ReguertaFirestoreEnvironment = ReguertaRuntimeEnvironment.currentFirestoreEnvironment
) async -> Set<String> {
    var updatedOrderIds = Set<String>()
    for orderId in Array(Set(orderIds)).filter(\.isNotEmpty) {
        let updated = await updateReceivedOrderProducerStatus(
            orderId: orderId,
            producerId: producerId,
            status: .read,
            db: db,
            environment: environment
        )
        if updated {
            updatedOrderIds.insert(orderId)
        }
    }
    return updatedOrderIds
}

private func buildReceivedOrdersSnapshot(
    from lines: [ReceivedOrderLineRecord],
    statusesByOrderId: [String: ProducerOrderStatus]
) -> ReceivedOrdersSnapshot {
    let byProductRows = Dictionary(grouping: lines, by: \.productId)
        .compactMap { productId, grouped -> ReceivedOrdersProductRow? in
            guard let first = grouped.first else { return nil }
            let totalQuantity = grouped.reduce(0) { partial, line in partial + line.quantity }
            return ReceivedOrdersProductRow(
                productId: productId,
                productName: first.productName,
                productImageUrl: first.productImageUrl,
                companyName: first.companyName,
                packagingLine: first.packagingLine,
                totalQuantity: totalQuantity,
                quantityUnitSingular: first.quantityUnitSingular,
                quantityUnitPlural: first.quantityUnitPlural
            )
        }
        .sorted { lhs, rhs in
            lhs.productName.localizedCaseInsensitiveCompare(rhs.productName) == .orderedAscending
        }

    let byMemberGroups = Dictionary(grouping: lines, by: { line in
        "\(line.consumerId)|\(line.consumerDisplayName)"
    })
        .compactMap { key, grouped -> ReceivedOrdersMemberGroup? in
            guard let first = grouped.first else { return nil }
            let memberLines = grouped.map { line in
                ReceivedOrdersMemberLine(
                    id: "\(line.orderId)|\(line.productId)",
                    productName: line.productName,
                    packagingLine: line.packagingLine,
                    quantity: line.quantity,
                    quantityUnitSingular: line.quantityUnitSingular,
                    quantityUnitPlural: line.quantityUnitPlural,
                    subtotal: line.subtotal
                )
            }.sorted { lhs, rhs in
                lhs.productName.localizedCaseInsensitiveCompare(rhs.productName) == .orderedAscending
            }
            let total = memberLines.reduce(0) { partial, line in partial + line.subtotal }
            return ReceivedOrdersMemberGroup(
                id: key,
                orderId: first.orderId,
                consumerDisplayName: first.consumerDisplayName,
                producerStatus: statusesByOrderId[first.orderId] ?? .unread,
                lines: memberLines,
                total: total
            )
        }
        .sorted { lhs, rhs in
            lhs.consumerDisplayName.localizedCaseInsensitiveCompare(rhs.consumerDisplayName) == .orderedAscending
        }

    return ReceivedOrdersSnapshot(
        byProductRows: byProductRows,
        byMemberGroups: byMemberGroups,
        generalTotal: lines.reduce(0) { partial, line in partial + line.subtotal }
    )
}

private func receivedOrderStatus(
    from data: [String: Any],
    producerId: String
) -> ProducerOrderStatus {
    if let statusesByVendor = data["producerStatusesByVendor"] as? [String: Any],
       let statusValue = statusesByVendor[producerId] as? String {
        return ProducerOrderStatus.from(statusValue)
    }
    return ProducerOrderStatus.from(data["producerStatus"] as? String)
}

private extension ReceivedOrdersSnapshot {
    func withProducerStatus(orderId: String, status: ProducerOrderStatus) -> ReceivedOrdersSnapshot {
        ReceivedOrdersSnapshot(
            byProductRows: byProductRows,
            byMemberGroups: byMemberGroups.map { group in
                if group.orderId == orderId {
                    return ReceivedOrdersMemberGroup(
                        id: group.id,
                        orderId: group.orderId,
                        consumerDisplayName: group.consumerDisplayName,
                        producerStatus: status,
                        lines: group.lines,
                        total: group.total
                    )
                }
                return group
            },
            generalTotal: generalTotal
        )
    }
}

private extension ProducerOrderStatus {
    var visualStyle: ProducerStatusVisualStyle {
        switch self {
        case .unread:
            return ProducerStatusVisualStyle(
                container: Color(.systemGray6).opacity(0.82),
                border: Color(.systemGray4)
            )
        case .read:
            return ProducerStatusVisualStyle(
                container: Color(.systemGray6).opacity(0.82),
                border: Color(.systemGray4)
            )
        case .prepared:
            return ProducerStatusVisualStyle(
                container: Color(red: 1.0, green: 0.95, blue: 0.84),
                border: Color(red: 0.84, green: 0.66, blue: 0.31)
            )
        case .delivered:
            return ProducerStatusVisualStyle(
                container: Color(red: 0.90, green: 0.97, blue: 0.90),
                border: Color(red: 0.46, green: 0.64, blue: 0.44)
            )
        }
    }
}

private func receivedOrderLineRecord(
    from data: [String: Any],
    fallbackDocumentID: String
) -> ReceivedOrderLineRecord? {
    let orderId = receivedOrderString(from: data["orderId"]) ?? fallbackDocumentID
    let consumerId = receivedOrderString(from: data["userId"]) ?? "__consumer_unknown__"
    let consumerDisplayName = receivedOrderString(from: data["consumerDisplayName"]) ?? consumerId
    let productId = receivedOrderString(from: data["productId"]) ?? fallbackDocumentID
    let productName = receivedOrderString(from: data["productName"]) ?? "Producto"
    let companyName = receivedOrderString(from: data["companyName"]) ?? "Productor"
    let productImageUrl = receivedOrderString(from: data["productImageUrl"])
    let quantity = receivedOrderDouble(from: data["quantity"]) ?? 0
    guard quantity > 0 else { return nil }
    let subtotal = receivedOrderDouble(from: data["subtotal"])
        ?? quantity * (receivedOrderDouble(from: data["priceAtOrder"]) ?? 0)
    let quantityUnitSingular = receivedOrderString(from: data["packContainerName"])
        ?? receivedOrderString(from: data["unitName"])
        ?? "ud."
    let quantityUnitPlural = receivedOrderString(from: data["packContainerPlural"])
        ?? receivedOrderString(from: data["unitPlural"])
        ?? quantityUnitSingular

    return ReceivedOrderLineRecord(
        id: "\(orderId)_\(productId)_\(consumerId)",
        orderId: orderId,
        consumerId: consumerId,
        consumerDisplayName: consumerDisplayName,
        productId: productId,
        productName: productName,
        productImageUrl: productImageUrl,
        companyName: companyName,
        packagingLine: receivedOrderPackagingLine(from: data),
        quantity: quantity,
        quantityUnitSingular: quantityUnitSingular,
        quantityUnitPlural: quantityUnitPlural,
        subtotal: subtotal
    )
}

private func receivedOrderPackagingLine(from data: [String: Any]) -> String {
    let containerName = receivedOrderString(from: data["packContainerName"])
        ?? receivedOrderString(from: data["unitName"])
        ?? ""
    let quantity = (receivedOrderDouble(from: data["packContainerQty"])
        ?? receivedOrderDouble(from: data["unitQty"])
        ?? 1).myOrderUiDecimal
    let unitLabel = receivedOrderString(from: data["packContainerAbbreviation"])
        ?? receivedOrderString(from: data["packContainerPlural"])
        ?? receivedOrderString(from: data["unitAbbreviation"])
        ?? receivedOrderString(from: data["unitPlural"])
        ?? receivedOrderString(from: data["unitName"])
        ?? ""

    return [containerName, quantity, unitLabel]
        .filter(\.isNotEmpty)
        .joined(separator: " ")
}

private func receivedOrderString(from value: Any?) -> String? {
    guard let raw = value as? String else { return nil }
    let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
}

private func receivedOrderDouble(from value: Any?) -> Double? {
    if let number = value as? NSNumber {
        return number.doubleValue
    }
    if let raw = value as? String {
        return Double(raw.replacingOccurrences(of: ",", with: "."))
    }
    return nil
}

private func receivedOrdersIsApproximatelyOne(_ value: Double) -> Bool {
    abs(value - 1) < 0.000_1
}

private let myOrderCommonPurchasesGroupId = "__my_order_reguerta_common_purchases__"
private let myOrderCartStoragePrefix = "reguerta_my_order_cart"
private let myOrderCartQuantitiesSuffix = ".quantities"
private let myOrderCartOptionsSuffix = ".eco_options"
private let myOrderConfirmedQuantitiesSuffix = ".confirmed_quantities"
private let myOrderConfirmedOptionsSuffix = ".confirmed_eco_options"

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
    case exceededCommitments([String])
    case incompatibleCommitments([String])
    case ecoBasketPriceMismatch
    case submitFailed
    case readyToSubmit(total: Double, noPickupEcoBaskets: Int)

    var id: String {
        switch self {
        case .missingCommitments(let names):
            return "missing:\(names.joined(separator: ","))"
        case .exceededCommitments(let names):
            return "exceeded:\(names.joined(separator: ","))"
        case .incompatibleCommitments(let names):
            return "incompatible:\(names.joined(separator: ","))"
        case .ecoBasketPriceMismatch:
            return "ecoBasketPriceMismatch"
        case .submitFailed:
            return "submitFailed"
        case .readyToSubmit(let total, let noPickupEcoBaskets):
            return "ready:\(total):\(noPickupEcoBaskets)"
        }
    }
}

private struct MyOrderCartSnapshot {
    let selectedQuantities: [String: Int]
    let selectedEcoBasketOptions: [String: String]
}

private struct MyOrderConfirmedLine: Identifiable {
    let product: Product
    let unitsSelected: Int
    let quantityAtOrder: Double
    let subtotal: Double

    var id: String { product.id }
}

private struct MyOrderConfirmedGroup: Identifiable {
    let vendorId: String
    let companyName: String
    let producerStatus: ProducerOrderStatus
    let lines: [MyOrderConfirmedLine]
    let subtotal: Double

    var id: String { vendorId }
}

private struct MyOrderProducerStatusSnapshot {
    let byVendor: [String: ProducerOrderStatus]
    let legacyStatus: ProducerOrderStatus
}

private struct MyOrderPreviousOrderLine: Identifiable {
    let vendorId: String
    let companyName: String
    let productName: String
    let packagingLine: String
    let quantityLabel: String
    let subtotal: Double

    var id: String { "\(vendorId)_\(productName)" }
}

private struct MyOrderPreviousOrderGroup: Identifiable {
    let vendorId: String
    let companyName: String
    let lines: [MyOrderPreviousOrderLine]
    let subtotal: Double

    var id: String { vendorId }
}

private struct MyOrderPreviousGroupKey: Hashable {
    let vendorId: String
    let companyName: String
}

private struct MyOrderPreviousOrderSnapshot {
    let weekKey: String
    let groups: [MyOrderPreviousOrderGroup]
    let total: Double
}

private enum MyOrderPreviousOrderState {
    case loading
    case loaded(MyOrderPreviousOrderSnapshot)
    case empty
    case error
}

private struct MyOrderConsultaWindow {
    let isConsultaPhase: Bool
    let previousWeekKey: String
}

private struct MyOrderRouteView: View {
    let tokens: ReguertaDesignTokens
    let products: [Product]
    let seasonalCommitments: [SeasonalCommitment]
    let shifts: [ShiftAssignment]
    let defaultDeliveryDayOfWeek: DeliveryWeekday?
    let deliveryCalendarOverrides: [DeliveryCalendarOverride]
    let nowMillis: Int64
    let isLoading: Bool
    let currentMember: Member?
    let members: [Member]
    let onRefresh: () -> Void
    let onCheckoutSuccessAcknowledge: () -> Void

    @State private var searchQuery = ""
    @State private var selectedQuantities: [String: Int] = [:]
    @State private var selectedEcoBasketOptions: [String: String] = [:]
    @State private var confirmedQuantities: [String: Int] = [:]
    @State private var confirmedEcoBasketOptions: [String: String] = [:]
    @State private var isCartVisible = false
    @State private var isSubmittingCheckout = false
    @State private var checkoutAlert: MyOrderCheckoutAlert?
    @State private var hasRestoredCartState = false
    @State private var isViewingConfirmedOrder = false
    @State private var previousOrderState: MyOrderPreviousOrderState = .loading
    @State private var confirmedProducerStatusesByVendor: [String: ProducerOrderStatus] = [:]
    @State private var confirmedLegacyProducerStatus: ProducerOrderStatus = .unread

    private var normalizedQuery: String {
        searchQuery.searchNormalized
    }

    private var currentWeekParity: ProducerParity {
        currentISOWeekProducerParity(nowMillis: nowMillis)
    }

    private var selectedProducts: [Product] {
        products.filter { selectedQuantities[$0.id, default: 0] > 0 }
    }

    private var selectedUnits: Int {
        selectedQuantities.values.reduce(0, +)
    }

    private var hasConfirmedOrder: Bool {
        !confirmedQuantities.isEmpty
    }

    private var hasPendingConfirmedEdits: Bool {
        hasConfirmedOrder && (
            selectedQuantities != confirmedQuantities ||
                selectedEcoBasketOptions != confirmedEcoBasketOptions
        )
    }

    private var isReadOnlyConfirmedView: Bool {
        hasConfirmedOrder && !hasPendingConfirmedEdits && isViewingConfirmedOrder
    }

    private var consultaWindow: MyOrderConsultaWindow {
        resolveMyOrderConsultaWindow(
            defaultDeliveryDayOfWeek: defaultDeliveryDayOfWeek,
            deliveryCalendarOverrides: deliveryCalendarOverrides,
            shifts: shifts,
            now: Date(timeIntervalSince1970: TimeInterval(nowMillis) / 1_000)
        )
    }

    private var isConsultaPhase: Bool {
        consultaWindow.isConsultaPhase
    }

    private var isReadOnlyMode: Bool {
        isReadOnlyConfirmedView || isConsultaPhase
    }

    private var consultaTaskID: String {
        let memberId = currentMember?.id ?? ""
        return "\(isConsultaPhase)-\(consultaWindow.previousWeekKey)-\(memberId)"
    }

    private var finalizeCheckoutTitle: String {
        hasConfirmedOrder && hasPendingConfirmedEdits ? "Guardar cambios" : "Finalizar compra"
    }

    private var canSubmitCheckout: Bool {
        !isSubmittingCheckout &&
            !isReadOnlyMode &&
            selectedUnits > 0 &&
            (!hasConfirmedOrder || hasPendingConfirmedEdits)
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

    private var currentWeekKey: String {
        nowMillis.isoWeekKey
    }

    private var cartStorageKey: String {
        "member_\(currentMember?.id ?? "")_week_\(currentWeekKey)"
    }

    private var currentOrderId: String? {
        guard let memberId = currentMember?.id, memberId.isNotEmpty else { return nil }
        return "\(memberId)_\(currentWeekKey)"
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

    private var confirmedOrderGroups: [MyOrderConfirmedGroup] {
        let lines = selectedProducts.compactMap { product -> MyOrderConfirmedLine? in
            let unitsSelected = selectedQuantities[product.id, default: 0]
            guard unitsSelected > 0 else { return nil }
            let quantityAtOrder: Double
            if product.pricingMode == .weight {
                quantityAtOrder = Double(unitsSelected) * product.unitQty
            } else {
                quantityAtOrder = Double(unitsSelected)
            }
            return MyOrderConfirmedLine(
                product: product,
                unitsSelected: unitsSelected,
                quantityAtOrder: quantityAtOrder,
                subtotal: quantityAtOrder * product.price
            )
        }

        return Dictionary(grouping: lines, by: { $0.product.vendorId })
            .compactMap { vendorId, groupedLines in
                guard let first = groupedLines.first else { return nil }
                let sortedLines = groupedLines.sorted {
                    $0.product.name.localizedCaseInsensitiveCompare($1.product.name) == .orderedAscending
                }
                return MyOrderConfirmedGroup(
                    vendorId: vendorId,
                    companyName: first.product.companyName,
                    producerStatus: confirmedProducerStatusesByVendor[vendorId] ?? confirmedLegacyProducerStatus,
                    lines: sortedLines,
                    subtotal: sortedLines.reduce(0) { $0 + $1.subtotal }
                )
            }
            .sorted {
                $0.companyName.localizedCaseInsensitiveCompare($1.companyName) == .orderedAscending
            }
    }

    private var seasonalCommitmentUnitLimitsByProductId: [String: Int] {
        seasonalCommitmentUnitLimitsByProductID(
            products: products,
            seasonalCommitments: seasonalCommitments
        )
    }

    @ViewBuilder
    private var readOnlyOrderContent: some View {
        if isConsultaPhase {
            previousOrderView
        } else {
            confirmedOrderView
        }
    }

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .bottom) {
                if isReadOnlyMode {
                    readOnlyOrderContent
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                } else {
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
                }

                if !isReadOnlyMode && !isCartVisible {
                    searchOverlay
                }

                if !isReadOnlyMode && isCartVisible {
                    Color.black.opacity(0.22)
                        .ignoresSafeArea()
                        .onTapGesture {
                            withAnimation(.easeInOut(duration: 0.22)) {
                                isCartVisible = false
                            }
                        }
                }

                if !isReadOnlyMode {
                    cartOverlay(proxy: proxy)
                }
            }
            .onChange(of: cartStorageKey, initial: true) { _, newStorageKey in
                let cartSnapshot = readMyOrderCartSnapshot(storageKey: newStorageKey)
                let confirmedSnapshot = readMyOrderConfirmedSnapshot(storageKey: newStorageKey)
                confirmedQuantities = confirmedSnapshot.selectedQuantities
                confirmedEcoBasketOptions = confirmedSnapshot.selectedEcoBasketOptions
                let initialSelectionSnapshot: MyOrderCartSnapshot = cartSnapshot.selectedQuantities.isEmpty
                    ? confirmedSnapshot
                    : cartSnapshot
                let isSelectionEqualToConfirmed = myOrderSnapshotsMatch(
                    initialSelectionSnapshot,
                    confirmedSnapshot
                )
                isViewingConfirmedOrder = !confirmedSnapshot.selectedQuantities.isEmpty && isSelectionEqualToConfirmed
                selectedQuantities = initialSelectionSnapshot.selectedQuantities
                selectedEcoBasketOptions = initialSelectionSnapshot.selectedEcoBasketOptions
                if initialSelectionSnapshot.selectedQuantities.isEmpty {
                    isCartVisible = false
                } else if isViewingConfirmedOrder {
                    isCartVisible = false
                }
                if confirmedSnapshot.selectedQuantities.isEmpty {
                    confirmedProducerStatusesByVendor = [:]
                    confirmedLegacyProducerStatus = .unread
                }
                hasRestoredCartState = true
            }
            .onChange(of: selectedQuantities) { _, _ in
                persistCurrentCartSnapshotIfNeeded()
            }
            .onChange(of: selectedEcoBasketOptions) { _, _ in
                persistCurrentCartSnapshotIfNeeded()
            }
            .onChange(of: products) { _, _ in
                sanitizeSelectedStateForCurrentProducts()
            }
            .onChange(of: seasonalCommitments) { _, _ in
                sanitizeSelectedStateForCurrentProducts()
            }
            .task(id: consultaTaskID) {
                guard isConsultaPhase else { return }
                await loadPreviousWeekOrderState(previousWeekKey: consultaWindow.previousWeekKey)
            }
            .task(id: "\(currentOrderId ?? "none")-\(hasConfirmedOrder)-\(isConsultaPhase)") {
                guard !isConsultaPhase, hasConfirmedOrder, let orderId = currentOrderId else {
                    confirmedProducerStatusesByVendor = [:]
                    confirmedLegacyProducerStatus = .unread
                    return
                }
                let statusSnapshot = await loadMyOrderProducerStatuses(orderId: orderId)
                confirmedProducerStatusesByVendor = statusSnapshot.byVendor
                confirmedLegacyProducerStatus = statusSnapshot.legacyStatus
            }
            .overlay {
                if let checkoutAlert {
                    checkoutDialog(checkoutAlert)
                }
            }
        }
    }

    private func persistCurrentCartSnapshotIfNeeded() {
        guard hasRestoredCartState else { return }
        persistMyOrderCartSnapshot(
            storageKey: cartStorageKey,
            selectedQuantities: selectedQuantities,
            selectedEcoBasketOptions: selectedEcoBasketOptions
        )
    }

    @MainActor
    private func loadPreviousWeekOrderState(previousWeekKey: String) async {
        previousOrderState = .loading
        do {
            let snapshot = try await fetchPreviousWeekOrderSnapshot(
                currentMember: currentMember,
                previousWeekKey: previousWeekKey
            )
            if let snapshot, !snapshot.groups.isEmpty {
                previousOrderState = .loaded(snapshot)
            } else {
                previousOrderState = .empty
            }
        } catch {
            previousOrderState = .error
        }
    }

    private func sanitizeSelectedStateForCurrentProducts() {
        let productsById = Dictionary(uniqueKeysWithValues: products.map { ($0.id, $0) })
        selectedQuantities = selectedQuantities.reduce(into: [:]) { partialResult, entry in
            guard let product = productsById[entry.key] else { return }
            guard entry.value > 0 else { return }
            var allowedQuantity: Int
            if let finiteLimit = finiteStockLimit(for: product) {
                allowedQuantity = min(entry.value, finiteLimit)
            } else {
                allowedQuantity = entry.value
            }
            if let commitmentLimit = seasonalCommitmentUnitLimitsByProductId[entry.key] {
                allowedQuantity = min(allowedQuantity, commitmentLimit)
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

    private var confirmedOrderView: some View {
        ZStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                HStack(spacing: tokens.spacing.sm) {
                    Text("Mi pedido")
                        .font(tokens.typography.titleCard.weight(.semibold))
                        .foregroundStyle(tokens.colors.textPrimary)
                    Spacer()
                    Button {
                        isViewingConfirmedOrder = false
                    } label: {
                        HStack(spacing: tokens.spacing.xs) {
                            Image(systemName: "pencil")
                            Text("Editar pedido")
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
                }

                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: tokens.spacing.md) {
                        ForEach(confirmedOrderGroups) { group in
                            confirmedProducerCard(group)
                        }
                    }
                    .padding(.bottom, 96.resize)
                }
            }

            HStack {
                Text("Suma total pedido: \(cartTotal.myOrderUiDecimal) €")
                    .font(tokens.typography.body.weight(.semibold))
                    .foregroundStyle(tokens.colors.textPrimary)
                    .frame(maxWidth: .infinity)
            }
            .padding(.horizontal, tokens.spacing.md)
            .padding(.vertical, tokens.spacing.sm)
            .background(tokens.colors.actionPrimary.opacity(0.3))
            .clipShape(Capsule())
            .padding(.horizontal, tokens.spacing.sm)
            .padding(.bottom, tokens.spacing.sm)
        }
    }

    @ViewBuilder
    private var previousOrderView: some View {
        ZStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                Text("Pedido anterior")
                    .font(tokens.typography.titleCard.weight(.semibold))
                    .foregroundStyle(tokens.colors.textPrimary)

                switch previousOrderState {
                case .loading:
                    ReguertaCard {
                        HStack(spacing: tokens.spacing.sm) {
                            ProgressView()
                                .tint(tokens.colors.actionPrimary)
                            Text("Cargando pedido de la semana anterior…")
                                .font(tokens.typography.bodySecondary)
                                .foregroundStyle(tokens.colors.textSecondary)
                        }
                    }

                case .empty:
                    ReguertaCard {
                        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                            Text("No hemos encontrado pedido para la semana anterior.")
                                .font(tokens.typography.bodySecondary)
                                .foregroundStyle(tokens.colors.textSecondary)
                            ReguertaButton("Actualizar", variant: .text, fullWidth: false) {
                                Task {
                                    await loadPreviousWeekOrderState(previousWeekKey: consultaWindow.previousWeekKey)
                                }
                            }
                        }
                    }

                case .error:
                    ReguertaCard {
                        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                            Text("No hemos podido cargar tu pedido anterior.")
                                .font(tokens.typography.bodySecondary)
                                .foregroundStyle(tokens.colors.textSecondary)
                            ReguertaButton("Reintentar", variant: .text, fullWidth: false) {
                                Task {
                                    await loadPreviousWeekOrderState(previousWeekKey: consultaWindow.previousWeekKey)
                                }
                            }
                        }
                    }

                case .loaded(let snapshot):
                    Text("Semana \(snapshot.weekKey)")
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)

                    ScrollView(.vertical, showsIndicators: false) {
                        VStack(spacing: tokens.spacing.md) {
                            ForEach(snapshot.groups) { group in
                                previousProducerCard(group)
                            }
                        }
                        .padding(.bottom, 96.resize)
                    }
                }
            }

            if case .loaded(let snapshot) = previousOrderState {
                HStack {
                    Text("Suma total pedido: \(snapshot.total.myOrderUiDecimal) €")
                        .font(tokens.typography.body.weight(.semibold))
                        .foregroundStyle(tokens.colors.textPrimary)
                        .frame(maxWidth: .infinity)
                }
                .padding(.horizontal, tokens.spacing.md)
                .padding(.vertical, tokens.spacing.sm)
                .background(tokens.colors.actionPrimary.opacity(0.3))
                .clipShape(Capsule())
                .padding(.horizontal, tokens.spacing.sm)
                .padding(.bottom, tokens.spacing.sm)
            }
        }
    }

    @ViewBuilder
    private func confirmedProducerCard(_ group: MyOrderConfirmedGroup) -> some View {
        let style = group.producerStatus.visualStyle
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            HStack(spacing: tokens.spacing.sm) {
                Text(group.companyName)
                    .font(tokens.typography.titleCard.weight(.semibold))
                    .foregroundStyle(tokens.colors.actionPrimary)
                Spacer(minLength: 0)
                Text(group.producerStatus.title)
                    .font(tokens.typography.label.weight(.semibold))
                    .foregroundStyle(tokens.colors.textSecondary)
            }

            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                ForEach(group.lines) { line in
                    VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                        HStack(alignment: .firstTextBaseline, spacing: tokens.spacing.sm) {
                            VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                                Text(line.product.name)
                                    .font(tokens.typography.body.weight(.semibold))
                                    .foregroundStyle(tokens.colors.textPrimary)
                                Text(packContainerLine(for: line.product))
                                    .font(tokens.typography.bodySecondary)
                                    .foregroundStyle(tokens.colors.textSecondary)
                            }
                            Spacer()
                            Text(confirmedQuantityLabel(for: line))
                                .font(tokens.typography.body.weight(.semibold))
                                .foregroundStyle(tokens.colors.textPrimary)
                            Text("\(line.subtotal.myOrderUiDecimal) €")
                                .font(tokens.typography.body.weight(.semibold))
                                .foregroundStyle(tokens.colors.textPrimary)
                        }
                        Divider()
                            .overlay(tokens.colors.borderSubtle)
                    }
                }

                HStack {
                    Spacer()
                    Text("Total: \(group.subtotal.myOrderUiDecimal) €")
                        .font(tokens.typography.body.weight(.semibold))
                        .foregroundStyle(Color(red: 0.78, green: 0.38, blue: 0.36))
                }
            }
        }
        .padding(tokens.spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(style.container)
        .overlay(
            RoundedRectangle(cornerRadius: tokens.radius.md)
                .stroke(style.border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: tokens.radius.md))
    }

    @ViewBuilder
    private func previousProducerCard(_ group: MyOrderPreviousOrderGroup) -> some View {
        ReguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(group.companyName)
                    .font(tokens.typography.titleCard.weight(.semibold))
                    .foregroundStyle(tokens.colors.actionPrimary)

                ForEach(group.lines) { line in
                    VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                        HStack(alignment: .firstTextBaseline, spacing: tokens.spacing.sm) {
                            VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                                Text(line.productName)
                                    .font(tokens.typography.body.weight(.semibold))
                                    .foregroundStyle(tokens.colors.textPrimary)
                                Text(line.packagingLine)
                                    .font(tokens.typography.bodySecondary)
                                    .foregroundStyle(tokens.colors.textSecondary)
                            }
                            Spacer()
                            Text(line.quantityLabel)
                                .font(tokens.typography.body.weight(.semibold))
                                .foregroundStyle(tokens.colors.textPrimary)
                            Text("\(line.subtotal.myOrderUiDecimal) €")
                                .font(tokens.typography.body.weight(.semibold))
                                .foregroundStyle(tokens.colors.textPrimary)
                        }
                        Divider()
                            .overlay(tokens.colors.borderSubtle)
                    }
                }

                HStack {
                    Spacer()
                    Text("Total: \(group.subtotal.myOrderUiDecimal) €")
                        .font(tokens.typography.body.weight(.semibold))
                        .foregroundStyle(Color(red: 0.78, green: 0.38, blue: 0.36))
                }
            }
        }
    }

    private func confirmedQuantityLabel(for line: MyOrderConfirmedLine) -> String {
        if line.product.pricingMode == .weight {
            let unitLabel = line.product.unitAbbreviation ?? line.product.unitName
            return "\(line.quantityAtOrder.myOrderUiDecimal) \(unitLabel)"
        }
        return "\(line.unitsSelected) \(line.unitsSelected == 1 ? "ud." : "uds.")"
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
                        quantityControls(
                            product: product,
                            quantity: quantity,
                            isEditable: !isReadOnlyMode
                        )
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
    private func quantityControls(
        product: Product,
        quantity: Int,
        isEditable: Bool
    ) -> some View {
        if !isEditable {
            if quantity > 0 {
                Text("\(quantity) \(quantity == 1 ? "ud." : "uds.")")
                    .font(tokens.typography.body.weight(.semibold))
                    .foregroundStyle(tokens.colors.textPrimary)
            }
        } else if quantity == 0 {
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
                    if isReadOnlyConfirmedView {
                        isViewingConfirmedOrder = false
                        withAnimation(.easeInOut(duration: 0.22)) {
                            isCartVisible = false
                        }
                    } else {
                        withAnimation(.easeInOut(duration: 0.22)) {
                            isCartVisible = false
                        }
                    }
                } label: {
                    HStack(spacing: tokens.spacing.xs) {
                        Image(systemName: isReadOnlyConfirmedView ? "pencil" : "basket")
                        Text(isReadOnlyConfirmedView ? "Editar pedido" : "Seguir comprando")
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
                if !isReadOnlyConfirmedView {
                    HStack {
                        Button {
                            validateCheckout()
                        } label: {
                            Text(finalizeCheckoutTitle)
                                .font(tokens.typography.body.weight(.semibold))
                                .foregroundStyle(tokens.colors.actionOnPrimary)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, tokens.spacing.sm)
                                .background(tokens.colors.actionPrimary)
                                .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                        .disabled(!canSubmitCheckout)
                        .opacity(canSubmitCheckout ? 1 : 0.55)
                    }
                    .padding(tokens.spacing.md)
                    .background(tokens.colors.surfacePrimary.opacity(0.95))
                }
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
                quantityControls(
                    product: product,
                    quantity: quantity,
                    isEditable: !isReadOnlyMode
                )
                if product.isEcoBasket, quantity > 0, !isReadOnlyMode {
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
        if !validation.incompatibleCommitmentProductNames.isEmpty {
            checkoutAlert = .incompatibleCommitments(validation.incompatibleCommitmentProductNames)
            return
        }
        if !validation.missingCommitmentProductNames.isEmpty {
            checkoutAlert = .missingCommitments(validation.missingCommitmentProductNames)
            return
        }
        if !validation.exceededCommitmentProductNames.isEmpty {
            checkoutAlert = .exceededCommitments(validation.exceededCommitmentProductNames)
            return
        }

        isSubmittingCheckout = true
        Task { @MainActor in
            let didPersist = await submitCheckoutOrderToFirestore(
                currentMember: currentMember,
                weekKey: currentWeekKey,
                products: products,
                selectedQuantities: selectedQuantities,
                selectedEcoBasketOptions: selectedEcoBasketOptions
            )
            isSubmittingCheckout = false

            guard didPersist else {
                checkoutAlert = .submitFailed
                return
            }

            persistMyOrderConfirmedSnapshot(
                storageKey: cartStorageKey,
                selectedQuantities: selectedQuantities,
                selectedEcoBasketOptions: selectedEcoBasketOptions
            )
            confirmedQuantities = selectedQuantities
            confirmedEcoBasketOptions = selectedEcoBasketOptions
            isViewingConfirmedOrder = true
            checkoutAlert = .readyToSubmit(
                total: cartTotal,
                noPickupEcoBaskets: noPickupEcoBasketUnits
            )
        }
    }

    @ViewBuilder
    private func checkoutDialog(_ alert: MyOrderCheckoutAlert) -> some View {
        switch alert {
        case .missingCommitments(let names):
            checkoutErrorDialog(
                title: "Faltan productos de compromiso",
                message: "Necesitas incluir al menos una unidad de: \(names.joined(separator: ", "))."
            )
        case .exceededCommitments(let names):
            checkoutErrorDialog(
                title: "Has superado el compromiso",
                message: "No puedes añadir más cantidad de la comprometida en: \(names.joined(separator: ", "))."
            )
        case .incompatibleCommitments(let names):
            checkoutErrorDialog(
                title: "Compromiso no representable",
                message: "La cantidad comprometida de \(names.joined(separator: ", ")) no encaja con el paso de compra actual. Contacta con administración."
            )
        case .ecoBasketPriceMismatch:
            checkoutErrorDialog(
                title: "Precio de ecocesta inconsistente",
                message: "Todas las ecocestas activas deben mantener el mismo precio para continuar."
            )
        case .submitFailed:
            checkoutErrorDialog(
                title: "No se pudo guardar el pedido",
                message: "Ha ocurrido un problema al guardar tu pedido. Inténtalo de nuevo."
            )
        case .readyToSubmit(let total, let noPickupEcoBaskets):
            ReguertaDialog(
                type: .info,
                title: "Pedido realizado con éxito",
                message: noPickupEcoBaskets > 0
                    ? "Todo correcto. Total: \(total.myOrderUiDecimal) €. Ecocestas marcadas como no_pickup: \(noPickupEcoBaskets). Tu pedido se ha guardado."
                    : "Todo correcto. Total: \(total.myOrderUiDecimal) €. Tu pedido se ha guardado.",
                primaryAction: ReguertaDialogAction(
                    title: "Aceptar",
                    action: handleCheckoutSuccessAcknowledged
                ),
                dismissible: false
            )
        }
    }

    private func checkoutErrorDialog(title: String, message: String) -> some View {
        ReguertaDialog(
            type: .error,
            title: title,
            message: message,
            primaryAction: ReguertaDialogAction(
                title: "Aceptar",
                action: { checkoutAlert = nil }
            ),
            onDismiss: { checkoutAlert = nil }
        )
    }

    private func handleCheckoutSuccessAcknowledged() {
        checkoutAlert = nil
        isCartVisible = false
        onCheckoutSuccessAcknowledge()
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
        if let commitmentLimit = seasonalCommitmentUnitLimitsByProductId[product.id],
           currentQuantity >= commitmentLimit {
            return false
        }
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
        guard !isReadOnlyMode else { return }
        let currentQuantity = selectedQuantities[product.id, default: 0]
        guard canIncrease(product: product, currentQuantity: currentQuantity) else { return }
        selectedQuantities[product.id] = currentQuantity + 1
        if product.isEcoBasket, selectedEcoBasketOptions[product.id] == nil {
            selectedEcoBasketOptions[product.id] = ecoBasketOptionPickup
        }
    }

    private func decrease(_ product: Product) {
        guard !isReadOnlyMode else { return }
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

private struct MyOrderCheckoutLineSnapshot {
    let product: Product
    let quantityAtOrder: Double
    let subtotal: Double
    let ecoBasketOption: String?
}

private func submitCheckoutOrderToFirestore(
    currentMember: Member?,
    weekKey: String,
    products: [Product],
    selectedQuantities: [String: Int],
    selectedEcoBasketOptions: [String: String],
    db: Firestore = Firestore.firestore(),
    environment: ReguertaFirestoreEnvironment = ReguertaRuntimeEnvironment.currentFirestoreEnvironment,
    nowMillis: Int64 = Int64(Date().timeIntervalSince1970 * 1_000)
) async -> Bool {
    guard let member = currentMember else {
        return false
    }

    let lineSnapshots = products.compactMap { product -> MyOrderCheckoutLineSnapshot? in
        let selectedUnits = selectedQuantities[product.id, default: 0]
        guard selectedUnits > 0 else { return nil }
        let quantityAtOrder: Double
        if product.pricingMode == .weight {
            quantityAtOrder = Double(selectedUnits) * product.unitQty
        } else {
            quantityAtOrder = Double(selectedUnits)
        }
        let subtotal = quantityAtOrder * product.price
        let selectedOption = selectedEcoBasketOptions[product.id]
        let ecoBasketOption = (selectedOption == ecoBasketOptionPickup || selectedOption == ecoBasketOptionNoPickup)
            ? selectedOption
            : nil
        return MyOrderCheckoutLineSnapshot(
            product: product,
            quantityAtOrder: quantityAtOrder,
            subtotal: subtotal,
            ecoBasketOption: ecoBasketOption
        )
    }
    guard !lineSnapshots.isEmpty else {
        return false
    }

    let firestorePath = ReguertaFirestorePath(environment: environment)
    let writeTargets = [
        (
            orders: firestorePath.collectionPath(.orders),
            orderlines: firestorePath.collectionPath(.orderlines)
        ),
        (
            orders: "\(environment.rawValue)/collections/orders",
            orderlines: "\(environment.rawValue)/collections/orderLines"
        ),
        (
            orders: "\(environment.rawValue)/collections/orders",
            orderlines: "\(environment.rawValue)/collections/orderlines"
        )
    ]
    let orderId = "\(member.id)_\(weekKey)"
    let nowDate = Date(timeIntervalSince1970: TimeInterval(nowMillis) / 1_000)
    let nowTimestamp = Timestamp(date: nowDate)
    let parsedWeek = weekKey.split(separator: "W").last.flatMap { Int($0) }
    let weekNumber = parsedWeek ?? Calendar(identifier: .iso8601).component(.weekOfYear, from: nowDate)

    let total = lineSnapshots.reduce(0) { $0 + $1.subtotal }
    let totalsByVendor = Dictionary(grouping: lineSnapshots, by: { $0.product.vendorId })
        .mapValues { snapshots in
            snapshots.reduce(0) { $0 + $1.subtotal }
        }

    for target in writeTargets {
        do {
            let orderRef = db.document("\(target.orders)/\(orderId)")

            let existingData = try? await orderRef.getDocument().data()
            let createdAt = (existingData?["createdAt"] as? Timestamp) ?? nowTimestamp
            let producerStatusCandidate = (existingData?["producerStatus"] as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines)
            let producerStatus = ProducerOrderStatus.from(producerStatusCandidate).rawValue
            let existingStatusesByVendor = existingData?["producerStatusesByVendor"] as? [String: Any]
            let producerStatusesByVendor = totalsByVendor.keys.reduce(into: [String: String]()) { partialResult, vendorId in
                let existingValue = existingStatusesByVendor?[vendorId] as? String
                let resolved = ProducerOrderStatus.from(existingValue ?? producerStatus).rawValue
                partialResult[vendorId] = resolved
            }
            let deliveryDate = (existingData?["deliveryDate"] as? Timestamp) ?? nowTimestamp

            let existingLinesSnapshot = try? await db.collection(target.orderlines)
                .whereField("orderId", isEqualTo: orderId)
                .getDocuments()

            let batch = db.batch()
            batch.setData([
                "userId": member.id,
                "consumerDisplayName": member.displayName,
                "week": weekNumber,
                "weekKey": weekKey,
                "deliveryDate": deliveryDate,
                "consumerStatus": "confirmado",
                "producerStatus": producerStatus,
                "producerStatusesByVendor": producerStatusesByVendor,
                "total": total,
                "totalsByVendor": totalsByVendor,
                "isAutoGenerated": false,
                "createdAt": createdAt,
                "updatedAt": nowTimestamp,
                "confirmedAt": nowTimestamp
            ], forDocument: orderRef, merge: true)

            for document in existingLinesSnapshot?.documents ?? [] {
                batch.deleteDocument(document.reference)
            }

            for line in lineSnapshots {
                let lineRef = db.document("\(target.orderlines)/\(orderId)_\(line.product.id)")
                batch.setData([
                    "orderId": orderId,
                    "userId": member.id,
                    "productId": line.product.id,
                    "vendorId": line.product.vendorId,
                    "consumerDisplayName": member.displayName,
                    "companyName": line.product.companyName,
                    "productName": line.product.name,
                    "productImageUrl": line.product.productImageUrl as Any,
                    "quantity": line.quantityAtOrder,
                    "priceAtOrder": line.product.price,
                    "subtotal": line.subtotal,
                    "pricingModeAtOrder": line.product.pricingMode.orderWireValue,
                    "unitName": line.product.unitName,
                    "unitAbbreviation": line.product.unitAbbreviation as Any,
                    "unitPlural": line.product.unitPlural,
                    "unitQty": line.product.unitQty,
                    "packContainerName": line.product.packContainerName as Any,
                    "packContainerAbbreviation": line.product.packContainerAbbreviation as Any,
                    "packContainerPlural": line.product.packContainerPlural as Any,
                    "packContainerQty": line.product.packContainerQty as Any,
                    "ecoBasketOptionAtOrder": line.ecoBasketOption as Any,
                    "week": weekNumber,
                    "weekKey": weekKey,
                    "createdAt": nowTimestamp,
                    "updatedAt": nowTimestamp
                ], forDocument: lineRef, merge: true)
            }

            try await batch.commit()

            let serverOrderSnapshot = try await orderRef.getDocument(source: .server)
            if serverOrderSnapshot.exists {
                return true
            }
        } catch {
            continue
        }
    }

    return false
}

private func myOrderSnapshotsMatch(
    _ lhs: MyOrderCartSnapshot,
    _ rhs: MyOrderCartSnapshot
) -> Bool {
    lhs.selectedQuantities == rhs.selectedQuantities &&
        lhs.selectedEcoBasketOptions == rhs.selectedEcoBasketOptions
}

private func resolveMyOrderConsultaWindow(
    defaultDeliveryDayOfWeek: DeliveryWeekday?,
    deliveryCalendarOverrides: [DeliveryCalendarOverride],
    shifts: [ShiftAssignment],
    now: Date = Date(),
    timeZone: TimeZone = TimeZone(identifier: "Europe/Madrid") ?? .current
) -> MyOrderConsultaWindow {
    var calendar = Calendar(identifier: .iso8601)
    calendar.timeZone = timeZone

    let weekStartDay = calendar.startOfDay(
        for: calendar.dateInterval(of: .weekOfYear, for: now)?.start ?? now
    )
    let weekEndDay = calendar.date(byAdding: .day, value: 6, to: weekStartDay) ?? weekStartDay
    let today = calendar.startOfDay(for: now)
    let currentWeekKey = String(
        format: "%04d-W%02d",
        calendar.component(.yearForWeekOfYear, from: weekStartDay),
        calendar.component(.weekOfYear, from: weekStartDay)
    )

    let effectiveDeliveryDate: Date
    if let override = deliveryCalendarOverrides.first(where: { $0.weekKey == currentWeekKey }) {
        effectiveDeliveryDate = calendar.startOfDay(
            for: Date(timeIntervalSince1970: TimeInterval(override.deliveryDateMillis) / 1_000)
        )
    } else if let currentWeekDeliveryShiftDate = shifts
        .filter({ $0.type == .delivery })
        .map({ calendar.startOfDay(for: Date(timeIntervalSince1970: TimeInterval($0.dateMillis) / 1_000)) })
        .filter({ $0 >= weekStartDay && $0 <= weekEndDay })
        .sorted(by: <)
        .first {
        effectiveDeliveryDate = currentWeekDeliveryShiftDate
    } else {
        let dayOffset = (defaultDeliveryDayOfWeek ?? .wednesday).myOrderDayOffset
        effectiveDeliveryDate = calendar.date(byAdding: .day, value: dayOffset, to: weekStartDay) ?? weekStartDay
    }

    let previousWeekDate = calendar.date(byAdding: .day, value: -7, to: weekStartDay) ?? weekStartDay
    let previousWeekKey = String(
        format: "%04d-W%02d",
        calendar.component(.yearForWeekOfYear, from: previousWeekDate),
        calendar.component(.weekOfYear, from: previousWeekDate)
    )
    let isConsultaPhase = today >= weekStartDay && today <= effectiveDeliveryDate

    return MyOrderConsultaWindow(
        isConsultaPhase: isConsultaPhase,
        previousWeekKey: previousWeekKey
    )
}

private func loadMyOrderProducerStatuses(
    orderId: String,
    db: Firestore = Firestore.firestore(),
    environment: ReguertaFirestoreEnvironment = ReguertaRuntimeEnvironment.currentFirestoreEnvironment
) async -> MyOrderProducerStatusSnapshot {
    let firestorePath = ReguertaFirestorePath(environment: environment)
    let readTargets = Array(Set([
        firestorePath.collectionPath(.orders),
        "\(environment.rawValue)/collections/orders"
    ]))

    for ordersPath in readTargets {
        do {
            let orderSnapshot = try await db.document("\(ordersPath)/\(orderId)").getDocument()
            guard orderSnapshot.exists else { continue }
            let payload = orderSnapshot.data() ?? [:]
            let legacyStatus = ProducerOrderStatus.from(payload["producerStatus"] as? String)
            let byVendor = myOrderProducerStatusesByVendor(from: payload)
            return MyOrderProducerStatusSnapshot(
                byVendor: byVendor,
                legacyStatus: legacyStatus
            )
        } catch {
            continue
        }
    }

    return MyOrderProducerStatusSnapshot(byVendor: [:], legacyStatus: .unread)
}

private func fetchPreviousWeekOrderSnapshot(
    currentMember: Member?,
    previousWeekKey: String,
    db: Firestore = Firestore.firestore(),
    environment: ReguertaFirestoreEnvironment = ReguertaRuntimeEnvironment.currentFirestoreEnvironment
) async throws -> MyOrderPreviousOrderSnapshot? {
    guard let member = currentMember else {
        return nil
    }

    let firestorePath = ReguertaFirestorePath(environment: environment)
    let readTargets = [
        (
            orders: firestorePath.collectionPath(.orders),
            orderlines: firestorePath.collectionPath(.orderlines)
        ),
        (
            orders: "\(environment.rawValue)/collections/orders",
            orderlines: "\(environment.rawValue)/collections/orderLines"
        ),
        (
            orders: "\(environment.rawValue)/collections/orders",
            orderlines: "\(environment.rawValue)/collections/orderlines"
        )
    ]
    let orderId = "\(member.id)_\(previousWeekKey)"
    var lastError: Error?
    var hasSuccessfulRead = false

    for target in readTargets {
        do {
            let orderRef = db.document("\(target.orders)/\(orderId)")
            let orderSnapshot = try await orderRef.getDocument()
            let linesSnapshot = try await db.collection(target.orderlines)
                .whereField("orderId", isEqualTo: orderId)
                .getDocuments()
            hasSuccessfulRead = true

            let lines = linesSnapshot.documents.map { document in
                myOrderPreviousLine(from: document.data())
            }

            let groups = buildMyOrderPreviousGroups(from: lines)

            if !orderSnapshot.exists && groups.isEmpty {
                continue
            }

            let total = (orderSnapshot.data()?["total"] as? NSNumber)?.doubleValue ??
                groups.reduce(0) { $0 + $1.subtotal }

            return MyOrderPreviousOrderSnapshot(
                weekKey: previousWeekKey,
                groups: groups,
                total: total
            )
        } catch {
            lastError = error
            continue
        }
    }

    if !hasSuccessfulRead, let lastError {
        throw lastError
    }
    return nil
}

private func buildMyOrderPreviousGroups(from lines: [MyOrderPreviousOrderLine]) -> [MyOrderPreviousOrderGroup] {
    let grouped = Dictionary(grouping: lines) { line in
        MyOrderPreviousGroupKey(
            vendorId: line.vendorId,
            companyName: line.companyName
        )
    }
    let groups = grouped.map { key, groupedLines -> MyOrderPreviousOrderGroup in
        let sortedLines = groupedLines.sorted {
            $0.productName.localizedCaseInsensitiveCompare($1.productName) == .orderedAscending
        }
        let subtotal = sortedLines.reduce(0.0) { partial, line in
            partial + line.subtotal
        }
        return MyOrderPreviousOrderGroup(
            vendorId: key.vendorId,
            companyName: key.companyName,
            lines: sortedLines,
            subtotal: subtotal
        )
    }
    return groups.sorted {
        $0.companyName.localizedCaseInsensitiveCompare($1.companyName) == .orderedAscending
    }
}

private func myOrderPreviousLine(from data: [String: Any]) -> MyOrderPreviousOrderLine {
    let vendorId = ((data["vendorId"] as? String)?
        .trimmingCharacters(in: .whitespacesAndNewlines))
        .flatMap { $0.isEmpty ? nil : $0 } ?? "__vendor_unknown__"
    let companyName = ((data["companyName"] as? String)?
        .trimmingCharacters(in: .whitespacesAndNewlines))
        .flatMap { $0.isEmpty ? nil : $0 } ?? vendorId
    let productName = ((data["productName"] as? String)?
        .trimmingCharacters(in: .whitespacesAndNewlines))
        .flatMap { $0.isEmpty ? nil : $0 } ?? "Producto"
    let quantity = (data["quantity"] as? NSNumber)?.doubleValue ?? 0
    let subtotal = (data["subtotal"] as? NSNumber)?.doubleValue
        ?? quantity * ((data["priceAtOrder"] as? NSNumber)?.doubleValue ?? 0)
    let unitName = ((data["unitName"] as? String)?
        .trimmingCharacters(in: .whitespacesAndNewlines))
        .flatMap { $0.isEmpty ? nil : $0 } ?? "ud."

    return MyOrderPreviousOrderLine(
        vendorId: vendorId,
        companyName: companyName,
        productName: productName,
        packagingLine: myOrderPackagingLine(from: data),
        quantityLabel: myOrderQuantityLabel(
            quantity: quantity,
            pricingMode: (data["pricingModeAtOrder"] as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines),
            unitName: unitName,
            unitAbbreviation: (data["unitAbbreviation"] as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines)
        ),
        subtotal: subtotal
    )
}

private func myOrderProducerStatusesByVendor(from data: [String: Any]) -> [String: ProducerOrderStatus] {
    guard let rawMap = data["producerStatusesByVendor"] as? [String: Any] else {
        return [:]
    }
    return rawMap.reduce(into: [:]) { partialResult, entry in
        let vendorId = entry.key.trimmingCharacters(in: .whitespacesAndNewlines)
        guard vendorId.isNotEmpty else { return }
        partialResult[vendorId] = ProducerOrderStatus.from(entry.value as? String)
    }
}

private func myOrderPackagingLine(from data: [String: Any]) -> String {
    let containerName = ((data["packContainerName"] as? String)?
        .trimmingCharacters(in: .whitespacesAndNewlines))
        .flatMap { $0.isEmpty ? nil : $0 } ??
        (((data["unitName"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines))
            .flatMap { $0.isEmpty ? nil : $0 } ?? "")
    let quantity = ((data["packContainerQty"] as? NSNumber)?.doubleValue
        ?? (data["unitQty"] as? NSNumber)?.doubleValue
        ?? 1).myOrderUiDecimal
    let unitName = ((data["unitName"] as? String)?
        .trimmingCharacters(in: .whitespacesAndNewlines))
        .flatMap { $0.isEmpty ? nil : $0 } ?? ""
    let unitPlural = ((data["unitPlural"] as? String)?
        .trimmingCharacters(in: .whitespacesAndNewlines))
        .flatMap { $0.isEmpty ? nil : $0 } ?? ""
    let unit = ((data["packContainerAbbreviation"] as? String)?
        .trimmingCharacters(in: .whitespacesAndNewlines))
        .flatMap { $0.isEmpty ? nil : $0 } ??
        ((data["packContainerPlural"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines))
        .flatMap { $0.isEmpty ? nil : $0 } ??
        ((data["unitAbbreviation"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines))
        .flatMap { $0.isEmpty ? nil : $0 } ??
        ((((data["packContainerQty"] as? NSNumber)?.doubleValue ?? 1) == 1) ? unitName : unitPlural)

    return [containerName, quantity, unit]
        .filter { !$0.isEmpty }
        .joined(separator: " ")
}

private func myOrderQuantityLabel(
    quantity: Double,
    pricingMode: String?,
    unitName: String,
    unitAbbreviation: String?
) -> String {
    if pricingMode?.lowercased() == "weight" {
        let unit = unitAbbreviation?.isEmpty == false ? unitAbbreviation! : unitName
        return "\(quantity.myOrderUiDecimal) \(unit)"
    }
    if quantity == 1 {
        return "1 ud."
    }
    return "\(quantity.myOrderUiDecimal) uds."
}

private func readMyOrderCartSnapshot(
    userDefaults: UserDefaults = .standard,
    storageKey: String
) -> MyOrderCartSnapshot {
    let quantitiesKey = "\(myOrderCartStoragePrefix).\(storageKey)\(myOrderCartQuantitiesSuffix)"
    let optionsKey = "\(myOrderCartStoragePrefix).\(storageKey)\(myOrderCartOptionsSuffix)"

    let restoredQuantities = (userDefaults.dictionary(forKey: quantitiesKey) ?? [:])
        .reduce(into: [String: Int]()) { partialResult, entry in
            let quantity = (entry.value as? Int) ?? (entry.value as? NSNumber)?.intValue ?? 0
            if quantity > 0 {
                partialResult[entry.key] = quantity
            }
        }

    let restoredOptions = (userDefaults.dictionary(forKey: optionsKey) ?? [:])
        .reduce(into: [String: String]()) { partialResult, entry in
            guard let option = entry.value as? String else { return }
            if option == ecoBasketOptionPickup || option == ecoBasketOptionNoPickup {
                partialResult[entry.key] = option
            }
        }

    return MyOrderCartSnapshot(
        selectedQuantities: restoredQuantities,
        selectedEcoBasketOptions: restoredOptions
    )
}

private func persistMyOrderCartSnapshot(
    userDefaults: UserDefaults = .standard,
    storageKey: String,
    selectedQuantities: [String: Int],
    selectedEcoBasketOptions: [String: String]
) {
    let quantitiesKey = "\(myOrderCartStoragePrefix).\(storageKey)\(myOrderCartQuantitiesSuffix)"
    let optionsKey = "\(myOrderCartStoragePrefix).\(storageKey)\(myOrderCartOptionsSuffix)"

    let normalizedQuantities = selectedQuantities.filter { $0.value > 0 }
    let normalizedOptions = selectedEcoBasketOptions
        .filter { normalizedQuantities[$0.key, default: 0] > 0 }
        .filter { $0.value == ecoBasketOptionPickup || $0.value == ecoBasketOptionNoPickup }

    if normalizedQuantities.isEmpty {
        userDefaults.removeObject(forKey: quantitiesKey)
    } else {
        userDefaults.set(normalizedQuantities, forKey: quantitiesKey)
    }

    if normalizedOptions.isEmpty {
        userDefaults.removeObject(forKey: optionsKey)
    } else {
        userDefaults.set(normalizedOptions, forKey: optionsKey)
    }
}

private func readMyOrderConfirmedSnapshot(
    userDefaults: UserDefaults = .standard,
    storageKey: String
) -> MyOrderCartSnapshot {
    let quantitiesKey = "\(myOrderCartStoragePrefix).\(storageKey)\(myOrderConfirmedQuantitiesSuffix)"
    let optionsKey = "\(myOrderCartStoragePrefix).\(storageKey)\(myOrderConfirmedOptionsSuffix)"

    let restoredQuantities = (userDefaults.dictionary(forKey: quantitiesKey) ?? [:])
        .reduce(into: [String: Int]()) { partialResult, entry in
            let quantity = (entry.value as? Int) ?? (entry.value as? NSNumber)?.intValue ?? 0
            if quantity > 0 {
                partialResult[entry.key] = quantity
            }
        }

    let restoredOptions = (userDefaults.dictionary(forKey: optionsKey) ?? [:])
        .reduce(into: [String: String]()) { partialResult, entry in
            guard let option = entry.value as? String else { return }
            if option == ecoBasketOptionPickup || option == ecoBasketOptionNoPickup {
                partialResult[entry.key] = option
            }
        }

    return MyOrderCartSnapshot(
        selectedQuantities: restoredQuantities,
        selectedEcoBasketOptions: restoredOptions
    )
}

private func persistMyOrderConfirmedSnapshot(
    userDefaults: UserDefaults = .standard,
    storageKey: String,
    selectedQuantities: [String: Int],
    selectedEcoBasketOptions: [String: String]
) {
    let quantitiesKey = "\(myOrderCartStoragePrefix).\(storageKey)\(myOrderConfirmedQuantitiesSuffix)"
    let optionsKey = "\(myOrderCartStoragePrefix).\(storageKey)\(myOrderConfirmedOptionsSuffix)"

    let normalizedQuantities = selectedQuantities.filter { $0.value > 0 }
    let normalizedOptions = selectedEcoBasketOptions
        .filter { normalizedQuantities[$0.key, default: 0] > 0 }
        .filter { $0.value == ecoBasketOptionPickup || $0.value == ecoBasketOptionNoPickup }

    if normalizedQuantities.isEmpty {
        userDefaults.removeObject(forKey: quantitiesKey)
    } else {
        userDefaults.set(normalizedQuantities, forKey: quantitiesKey)
    }

    if normalizedOptions.isEmpty {
        userDefaults.removeObject(forKey: optionsKey)
    } else {
        userDefaults.set(normalizedOptions, forKey: optionsKey)
    }
}

private extension ProductPricingMode {
    var orderWireValue: String {
        switch self {
        case .fixed:
            return "fixed"
        case .weight:
            return "weight"
        }
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

private extension DeliveryWeekday {
    var myOrderDayOffset: Int {
        switch self {
        case .monday: return 0
        case .tuesday: return 1
        case .wednesday: return 2
        case .thursday: return 3
        case .friday: return 4
        case .saturday: return 5
        case .sunday: return 6
        }
    }
}

private extension Array {
    func chunked(into size: Int) -> [[Element]] {
        guard !isEmpty else { return [] }
        guard size > 0 else { return [self] }
        var result: [[Element]] = []
        var index = startIndex
        while index < endIndex {
            let nextIndex = self.index(index, offsetBy: size, limitedBy: endIndex) ?? endIndex
            result.append(Array(self[index..<nextIndex]))
            index = nextIndex
        }
        return result
    }
}
