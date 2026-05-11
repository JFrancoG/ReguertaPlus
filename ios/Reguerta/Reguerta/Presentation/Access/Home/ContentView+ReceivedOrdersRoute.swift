import SwiftUI

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

struct ReceivedOrdersRouteView: View {
    let tokens: ReguertaDesignTokens
    let currentMember: Member?
    let shifts: [ShiftAssignment]
    let defaultDeliveryDayOfWeek: DeliveryWeekday?
    let deliveryCalendarOverrides: [DeliveryCalendarOverride]
    let nowMillis: Int64

    @State private var selectedTab: ReceivedOrdersTab = .byProduct
    @State private var loadState: ReceivedOrdersLoadState = .idle
    @State private var updatingStatusOrderId: String?
    @State private var statusWriteFeedback: ReceivedOrderStatusWriteResult?

    private var isProducer: Bool {
        currentMember?.canAccessReceivedOrders == true
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
            statusFeedbackView

            routeContent
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .task(id: loadTaskID) {
            await loadIfNeeded()
        }
    }

    @ViewBuilder
    private var statusFeedbackView: some View {
        switch statusWriteFeedback {
        case .permissionDenied:
            Text("No tienes permiso para actualizar este estado de productor.")
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.feedbackError)
                .frame(maxWidth: .infinity, alignment: .leading)
        case .failure:
            Text("No se pudo guardar el estado de productor. Inténtalo de nuevo.")
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.feedbackError)
                .frame(maxWidth: .infinity, alignment: .leading)
        case .success, .none:
            EmptyView()
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
}

private extension ReceivedOrdersRouteView {
    @ViewBuilder
    func loadedContent(_ snapshot: ReceivedOrdersSnapshot) -> some View {
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
                                    let updateResult = await updateReceivedOrderProducerStatus(
                                        orderId: group.orderId,
                                        producerId: producerId,
                                        status: status
                                    )
                                    if updateResult == .success {
                                        statusWriteFeedback = nil
                                        if case .loaded(let currentSnapshot) = loadState {
                                            loadState = .loaded(
                                                currentSnapshot.withProducerStatus(orderId: group.orderId, status: status)
                                            )
                                        }
                                    } else {
                                        statusWriteFeedback = updateResult
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
    func productCard(_ row: ReceivedOrdersProductRow) -> some View {
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
    func memberCard(
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

            memberLinesSection(group)
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
    func memberLinesSection(_ group: ReceivedOrdersMemberGroup) -> some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            ForEach(group.lines.indices, id: \.self) { index in
                let line = group.lines[index]
                memberLineRow(line)
                if index < group.lines.count - 1 {
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

    @ViewBuilder
    func memberLineRow(_ line: ReceivedOrdersMemberLine) -> some View {
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
    }

    @ViewBuilder
    func producerStatusSelector(
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
    func totalBar(total: Double) -> some View {
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
    func infoCard(title: String, body: String) -> some View {
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
    func receivedOrdersProductImage(urlString: String?) -> some View {
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
    func loadIfNeeded(force: Bool = false) async {
        guard isProducer else {
            loadState = .idle
            statusWriteFeedback = nil
            return
        }
        guard window.isEnabled else {
            loadState = .idle
            statusWriteFeedback = nil
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
        statusWriteFeedback = nil
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
