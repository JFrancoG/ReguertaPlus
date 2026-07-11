import SwiftUI

struct ReceivedOrdersRouteView: View {
    let tokens: ReguertaDesignTokens
    let viewModel: ReceivedOrdersRouteViewModel
    let context: ReceivedOrdersRouteContext

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.md) {
            tabSelector
            statusFeedbackView

            routeContent
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .task(id: context.identity) {
            await viewModel.appear(context: context)
        }
    }

    @ViewBuilder
    private var statusFeedbackView: some View {
        switch viewModel.statusWriteFeedback {
        case .permissionDenied:
            Text(l10n(AccessL10nKey.receivedOrdersStatusPermissionDenied))
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.feedbackError)
                .frame(maxWidth: .infinity, alignment: .leading)
        case .failure:
            Text(l10n(AccessL10nKey.receivedOrdersStatusFailure))
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.feedbackError)
                .frame(maxWidth: .infinity, alignment: .leading)
        case .success, .none:
            EmptyView()
        }
    }

    @ViewBuilder
    private var tabSelector: some View {
        Picker(
            l10n(AccessL10nKey.receivedOrdersTabsTitle),
            selection: Binding(
                get: { viewModel.selectedTab },
                set: { tab in
                    withAnimation(.snappy(duration: 0.22)) {
                        viewModel.selectTab(tab)
                    }
                }
            )
        ) {
            ForEach(ReceivedOrdersTab.allCases) { tab in
                Text(tab.title)
                    .font(tokens.typography.label.weight(.semibold))
                    .tag(tab)
            }
        }
        .pickerStyle(.segmented)
        .tint(tokens.colors.actionPrimary)
        .accessibilityIdentifier("receivedOrders.tabSelector")
    }

    @ViewBuilder
    private var routeContent: some View {
        if !viewModel.isProducer {
            infoCard(
                title: l10n(AccessL10nKey.receivedOrdersProducerOnlyTitle),
                body: l10n(AccessL10nKey.receivedOrdersProducerOnlyBody)
            )
        } else if !viewModel.window.isEnabled {
            windowClosedCard
        } else {
            switch viewModel.loadState {
            case .idle, .loading:
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            case .empty:
                infoCard(
                    title: l10n(AccessL10nKey.receivedOrdersEmptyTitle),
                    body: l10n(
                        AccessL10nKey.receivedOrdersEmptyBodyFormat,
                        viewModel.window.targetWeekKey
                    )
                )
            case .error:
                reguertaCard {
                    VStack(alignment: .leading, spacing: tokens.spacing.md) {
                        Text(l10n(AccessL10nKey.receivedOrdersErrorTitle))
                            .font(tokens.typography.titleCard.weight(.semibold))
                            .foregroundStyle(tokens.colors.feedbackError)
                        Text(l10n(AccessL10nKey.receivedOrdersErrorBody))
                            .font(tokens.typography.bodySecondary)
                            .foregroundStyle(tokens.colors.textSecondary)
                        reguertaButton(LocalizedStringKey(AccessL10nKey.receivedOrdersRetry)) {
                            Task {
                                await viewModel.retry()
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
    var windowClosedCard: some View {
        let shape = RoundedRectangle(cornerRadius: tokens.radius.lg, style: .continuous)

        return HStack(alignment: .top, spacing: tokens.spacing.md) {
            Image(systemName: "calendar.badge.clock")
                .font(.system(size: 20.resize, weight: .semibold))
                .foregroundStyle(tokens.colors.actionPrimary)
                .frame(width: 44.resize, height: 44.resize)
                .background(
                    tokens.colors.actionPrimary.opacity(0.14),
                    in: RoundedRectangle(cornerRadius: tokens.radius.md, style: .continuous)
                )
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(l10n(AccessL10nKey.receivedOrdersWindowClosedTitle))
                    .font(tokens.typography.titleCard.weight(.semibold))
                    .foregroundStyle(tokens.colors.textPrimary)
                Text(l10n(AccessL10nKey.receivedOrdersWindowClosedBody))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(tokens.spacing.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(tokens.colors.actionPrimary.opacity(0.09), in: shape)
        .overlay(shape.stroke(tokens.colors.actionPrimary.opacity(0.28), lineWidth: 1.resize))
    }

    @ViewBuilder
    func loadedContent(_ snapshot: ReceivedOrdersSnapshot) -> some View {
        ReceivedOrdersSummaryContent(
            tokens: tokens,
            snapshot: snapshot,
            selectedTab: viewModel.selectedTab,
            updatingStatusOrderId: viewModel.updatingStatusOrderId,
            showsStatusActions: true,
            onSelectStatus: { orderId, status in
                Task {
                    await viewModel.updateProducerStatus(orderId: orderId, status: status)
                }
            }
        )
        .accessibilityIdentifier("receivedOrders.summaryContent")
    }

    func receivedOrdersList<Content: View>(
        bottomPadding: CGFloat,
        @ViewBuilder content: @escaping () -> Content
    ) -> some View {
        ScrollView(.vertical, showsIndicators: false) {
            LazyVStack(spacing: tokens.spacing.md) {
                content()
            }
            .frame(maxWidth: .infinity)
            .padding(.bottom, bottomPadding)
        }
        .ignoresSafeArea(.container, edges: .bottom)
    }

    var totalBarScrollBottomPadding: CGFloat {
        72.resize + 8.resizeBottomSize
    }

    var receivedOrdersProductNameFont: Font {
        .custom("CabinSketch-Bold", size: 16.resize, relativeTo: .subheadline)
    }

    var receivedOrdersSmallDetailFont: Font {
        .custom("CabinSketch-Regular", size: 11.resize, relativeTo: .caption)
    }

    var receivedOrdersProductQuantityFont: Font {
        .custom("CabinSketch-Bold", size: 28.resize, relativeTo: .title2)
    }

    var receivedOrdersParentheticalFont: Font {
        .custom("CabinSketch-Regular", size: 12.resize, relativeTo: .caption)
    }

    var receivedOrdersMemberAmountFont: Font {
        .custom("CabinSketch-Bold", size: 18.resize, relativeTo: .body)
    }

    var receivedOrdersMemberTotalFont: Font {
        .custom("CabinSketch-Bold", size: 20.resize, relativeTo: .headline)
    }

    var receivedOrdersGeneralTotalFont: Font {
        .custom("CabinSketch-Bold", size: 22.resize, relativeTo: .headline)
    }

    @ViewBuilder
    func productCard(_ row: ReceivedOrdersProductRow) -> some View {
        reguertaListItemCard {
            HStack(alignment: .center, spacing: 0) {
                receivedOrdersProductImage(urlString: row.productImageUrl)
                    .frame(width: 76.resize)

                verticalDivider(height: 72.resize)

                VStack(alignment: .center, spacing: 4.resize) {
                    Text(row.productName)
                        .font(receivedOrdersProductNameFont)
                        .foregroundStyle(tokens.colors.actionPrimary)
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                    Text(row.packagingLine)
                        .font(receivedOrdersSmallDetailFont)
                        .foregroundStyle(tokens.colors.textSecondary)
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                }
                .frame(maxWidth: .infinity)
                .padding(.horizontal, tokens.spacing.sm)

                verticalDivider(height: 72.resize)

                VStack(alignment: .center, spacing: 4.resize) {
                    Text(row.totalQuantity.myOrderUiDecimal)
                        .font(receivedOrdersProductQuantityFont)
                        .foregroundStyle(tokens.colors.textPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.78)
                    Text(row.totalMeasureLabel())
                        .font(receivedOrdersSmallDetailFont)
                        .foregroundStyle(tokens.colors.textSecondary)
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                        .minimumScaleFactor(0.78)
                }
                .frame(width: 88.resize)
            }
            .padding(.vertical, tokens.spacing.sm)
            .padding(.horizontal, tokens.spacing.sm)
        }
    }

    @ViewBuilder
    func memberCard(
        _ group: ReceivedOrdersMemberGroup,
        isUpdatingStatus: Bool,
        onSelectStatus: @escaping (ProducerOrderStatus) -> Void
    ) -> some View {
        reguertaListItemCard {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                HStack(alignment: .firstTextBaseline, spacing: tokens.spacing.sm) {
                    Text(group.consumerDisplayName)
                        .font(tokens.typography.body.weight(.semibold))
                        .foregroundStyle(tokens.colors.actionPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .lineLimit(1)
                        .minimumScaleFactor(0.78)

                    producerStatusHeaderButton(
                        selectedStatus: group.producerStatus,
                        isUpdatingStatus: isUpdatingStatus,
                        onSelectStatus: onSelectStatus
                    )
                }

                horizontalDivider()

                memberLinesSection(group)
            }
            .padding(tokens.spacing.md)
        }
    }

    @ViewBuilder
    func memberLinesSection(_ group: ReceivedOrdersMemberGroup) -> some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            ForEach(Array(group.lines.enumerated()), id: \.element.id) { _, line in
                memberLineRow(line)
                horizontalDivider(opacity: 0.6)
            }

            Text("Total: \(group.total.euroCurrencyText())")
                .font(receivedOrdersMemberTotalFont)
                .foregroundStyle(tokens.colors.feedbackError)
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
    }

    @ViewBuilder
    func memberLineRow(_ line: ReceivedOrdersMemberLine) -> some View {
        HStack(alignment: .center, spacing: tokens.spacing.sm) {
            VStack(alignment: .leading, spacing: 4.resize) {
                Text(line.productName)
                    .font(tokens.typography.bodySecondary.weight(.semibold))
                    .foregroundStyle(tokens.colors.textPrimary)
                    .lineLimit(2)
                Text(line.packagingLine)
                    .font(tokens.typography.labelRegular)
                    .foregroundStyle(tokens.colors.textSecondary)
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            verticalDivider(height: 50.resize)

            VStack(alignment: .center, spacing: 4.resize) {
                HStack(alignment: .firstTextBaseline, spacing: 3.resize) {
                    Text(line.quantity.myOrderUiDecimal)
                        .font(receivedOrdersMemberAmountFont)
                        .foregroundStyle(tokens.colors.textPrimary)
                    Text("(\(line.totalMeasureLabel()))")
                        .font(receivedOrdersParentheticalFont)
                        .foregroundStyle(tokens.colors.textSecondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                Text(line.subtotal.euroCurrencyText())
                    .font(receivedOrdersMemberAmountFont)
                    .foregroundStyle(tokens.colors.textPrimary)
            }
            .frame(width: 112.resize)
        }
    }

    func producerStatusHeaderButton(
        selectedStatus: ProducerOrderStatus,
        isUpdatingStatus: Bool,
        onSelectStatus: @escaping (ProducerOrderStatus) -> Void
    ) -> some View {
        let style = selectedStatus.visualStyle
        let targetStatus = nextProducerStatus(after: selectedStatus)
        let shape = RoundedRectangle(cornerRadius: tokens.radius.sm, style: .continuous)

        return Button {
            if let targetStatus {
                onSelectStatus(targetStatus)
            }
        } label: {
            Text(isUpdatingStatus ? "Guardando..." : selectedStatus.title)
                .font(tokens.typography.labelRegular.weight(.semibold))
                .foregroundStyle(tokens.colors.textPrimary)
                .lineLimit(1)
                .padding(.horizontal, tokens.spacing.sm)
                .padding(.vertical, 6.resize)
                .background(shape.fill(style.container))
                .overlay(shape.stroke(style.border, lineWidth: 1.resize))
        }
        .buttonStyle(.plain)
        .disabled(targetStatus == nil || isUpdatingStatus)
    }

    func nextProducerStatus(after status: ProducerOrderStatus) -> ProducerOrderStatus? {
        switch status {
        case .unread, .read:
            return .prepared
        case .prepared:
            return .read
        case .delivered:
            return nil
        }
    }

    func horizontalDivider(opacity: Double = 0.8) -> some View {
        Divider()
            .overlay(tokens.colors.borderSubtle.opacity(opacity))
    }

    func verticalDivider(height: CGFloat) -> some View {
        Rectangle()
            .fill(tokens.colors.borderSubtle.opacity(0.55))
            .frame(width: 1.resize, height: height)
    }

    @ViewBuilder
    func totalBar(total: Double) -> some View {
        let shape = RoundedRectangle(cornerRadius: 8.resize, style: .continuous)

        HStack {
            Text("Suma total general: \(total.euroCurrencyText())")
                .font(receivedOrdersGeneralTotalFont)
                .foregroundStyle(tokens.colors.textPrimary)
                .frame(maxWidth: .infinity, alignment: .center)
                .minimumScaleFactor(0.86)
        }
        .padding(.horizontal, tokens.spacing.md)
        .frame(height: 50.resize)
        .background(shape.fill(tokens.colors.actionPrimary.opacity(0.7)))
        .overlay(
            shape.stroke(tokens.colors.borderSubtle.opacity(0.65), lineWidth: 1.resize)
        )
        .clipShape(shape)
        .padding(.horizontal, tokens.spacing.sm)
        .padding(.bottom, 8.resizeBottomSize)
        .allowsHitTesting(false)
    }

    @ViewBuilder
    func infoCard(title: String, body: String) -> some View {
        reguertaCard {
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
}
