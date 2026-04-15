import FirebaseFirestore
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

enum ProducerOrderStatus: String, CaseIterable {
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

struct ProducerStatusVisualStyle {
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

// swiftlint:disable:next type_body_length
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
    private func memberLinesSection(_ group: ReceivedOrdersMemberGroup) -> some View {
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
    private func memberLineRow(_ line: ReceivedOrdersMemberLine) -> some View {
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
    let readTargets = receivedOrderlineReadTargets(
        firestorePath: firestorePath,
        environment: environment
    )
    let lines = try await fetchReceivedOrderLines(
        producerId: producerId,
        targetWeekKey: targetWeekKey,
        readTargets: readTargets,
        db: db
    )
    guard !lines.isEmpty else { return nil }
    let statusesByOrderId = try await fetchReceivedOrderStatusesByOrderId(
        orderIds: lines.map(\.orderId),
        producerId: producerId,
        db: db,
        environment: environment
    )
    let synchronizedStatuses = await synchronizeUnreadReceivedOrderStatuses(
        statusesByOrderId: statusesByOrderId,
        producerId: producerId,
        db: db,
        environment: environment
    )

    return buildReceivedOrdersSnapshot(from: lines, statusesByOrderId: synchronizedStatuses)
}

private func receivedOrderlineReadTargets(
    firestorePath: ReguertaFirestorePath,
    environment: ReguertaFirestoreEnvironment
) -> [String] {
    Array(Set([
        firestorePath.collectionPath(.orderlines),
        "\(environment.rawValue)/collections/orderLines",
        "\(environment.rawValue)/collections/orderlines"
    ]))
}

private func fetchReceivedOrderLines(
    producerId: String,
    targetWeekKey: String,
    readTargets: [String],
    db: Firestore
) async throws -> [ReceivedOrderLineRecord] {
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

    return dedupedLinesByKey.values.sorted { lhs, rhs in
        if lhs.consumerDisplayName != rhs.consumerDisplayName {
            return lhs.consumerDisplayName.localizedCaseInsensitiveCompare(rhs.consumerDisplayName) == .orderedAscending
        }
        return lhs.productName.localizedCaseInsensitiveCompare(rhs.productName) == .orderedAscending
    }
}

private func synchronizeUnreadReceivedOrderStatuses(
    statusesByOrderId: [String: ProducerOrderStatus],
    producerId: String,
    db: Firestore,
    environment: ReguertaFirestoreEnvironment
) async -> [String: ProducerOrderStatus] {
    let unreadOrderIds = statusesByOrderId
        .filter { $0.value == .unread }
        .map(\.key)
    guard !unreadOrderIds.isEmpty else {
        return statusesByOrderId
    }

    let markedAsRead = await markReceivedOrdersAsRead(
        orderIds: unreadOrderIds,
        producerId: producerId,
        db: db,
        environment: environment
    )
    guard !markedAsRead.isEmpty else {
        return statusesByOrderId
    }

    var synchronizedStatuses = statusesByOrderId
    for orderId in markedAsRead {
        synchronizedStatuses[orderId] = .read
    }
    return synchronizedStatuses
}

private func buildReceivedOrdersProductRows(
    from lines: [ReceivedOrderLineRecord]
) -> [ReceivedOrdersProductRow] {
    Dictionary(grouping: lines, by: \.productId)
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
}

private func buildReceivedOrdersMemberGroups(
    from lines: [ReceivedOrderLineRecord],
    statusesByOrderId: [String: ProducerOrderStatus]
) -> [ReceivedOrdersMemberGroup] {
    Dictionary(grouping: lines, by: { line in
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
}

private func receivedOrdersGeneralTotal(from lines: [ReceivedOrderLineRecord]) -> Double {
    lines.reduce(0) { partial, line in
        partial + line.subtotal
    }
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
    let byProductRows = buildReceivedOrdersProductRows(from: lines)
    let byMemberGroups = buildReceivedOrdersMemberGroups(
        from: lines,
        statusesByOrderId: statusesByOrderId
    )

    return ReceivedOrdersSnapshot(
        byProductRows: byProductRows,
        byMemberGroups: byMemberGroups,
        generalTotal: receivedOrdersGeneralTotal(from: lines)
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

extension ProducerOrderStatus {
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
