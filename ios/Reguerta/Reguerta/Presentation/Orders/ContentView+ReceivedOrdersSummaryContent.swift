import SwiftUI

struct ReceivedOrdersSummaryContent: View {
    let tokens: ReguertaDesignTokens
    let snapshot: ReceivedOrdersSnapshot
    let selectedTab: ReceivedOrdersTab
    let updatingStatusOrderId: String?
    let showsStatusActions: Bool
    let onSelectStatus: (String, ProducerOrderStatus) -> Void

    @Environment(\.locale) private var locale

    private var presentationLocale: Locale {
        reguertaPresentationLocale(fallback: locale)
    }

    var body: some View {
        switch selectedTab {
        case .byProduct:
            receivedOrdersList {
                ForEach(snapshot.byProductRows) { row in
                    productCard(row)
                }
            }

        case .byMember:
            receivedOrdersList {
                ForEach(snapshot.byMemberGroups) { group in
                    memberCard(
                        group,
                        isUpdatingStatus: updatingStatusOrderId == group.orderId,
                        onSelectStatus: { status in
                            onSelectStatus(group.orderId, status)
                        }
                    )
                }
            }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                totalBar(total: snapshot.generalTotal)
            }
        }
    }
}

extension ReceivedOrdersSummaryContent {
    func receivedOrdersList<Content: View>(
        @ViewBuilder content: @escaping () -> Content
    ) -> some View {
        ScrollView(.vertical, showsIndicators: false) {
            LazyVStack(spacing: tokens.spacing.md) {
                content()
            }
            .frame(maxWidth: .infinity)
            .padding(.bottom, tokens.spacing.sm)
        }
    }

    var receivedOrdersProductNameFont: Font {
        tokens.typography.bodySecondary.weight(.bold)
    }

    var receivedOrdersSmallDetailFont: Font {
        tokens.typography.labelRegular
    }

    var receivedOrdersProductQuantityFont: Font {
        tokens.typography.titleSection
    }

    var receivedOrdersParentheticalFont: Font {
        tokens.typography.labelRegular
    }

    var receivedOrdersMemberAmountFont: Font {
        tokens.typography.body.weight(.bold)
    }

    var receivedOrdersMemberTotalFont: Font {
        tokens.typography.titleCard.weight(.bold)
    }

    var receivedOrdersGeneralTotalFont: Font {
        tokens.typography.titleDialog
    }

    @ViewBuilder func productCard(_ row: ReceivedOrdersProductRow) -> some View {
        reguertaListItemCard {
            ViewThatFits(in: .horizontal) {
                wideProductSummary(row)
                compactProductSummary(row)
            }
            .padding(.vertical, tokens.spacing.sm)
            .padding(.horizontal, tokens.spacing.sm)
        }
    }

    func wideProductSummary(_ row: ReceivedOrdersProductRow) -> some View {
        HStack(alignment: .center, spacing: 0) {
            receivedOrdersProductImage(urlString: row.productImageUrl)
                .frame(width: OrderAdaptiveLayoutMetrics.summaryProductColumnWidth)

            verticalDivider(height: OrderAdaptiveLayoutMetrics.largeDividerHeight)

            productDescription(row)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, tokens.spacing.sm)

            verticalDivider(height: OrderAdaptiveLayoutMetrics.largeDividerHeight)

            productQuantity(row)
                .frame(width: OrderAdaptiveLayoutMetrics.summaryTotalQuantityColumnWidth)
        }
    }

    func compactProductSummary(_ row: ReceivedOrdersProductRow) -> some View {
        HStack(alignment: .center, spacing: tokens.spacing.md) {
            receivedOrdersProductImage(urlString: row.productImageUrl)
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                productDescription(row)
                    .frame(maxWidth: .infinity, alignment: .leading)
                productQuantity(row)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    func productDescription(_ row: ReceivedOrdersProductRow) -> some View {
        VStack(alignment: .center, spacing: tokens.spacing.xs) {
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
    }

    func productQuantity(_ row: ReceivedOrdersProductRow) -> some View {
        VStack(alignment: .center, spacing: tokens.spacing.xs) {
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

                    if showsStatusActions {
                        producerStatusHeaderButton(
                            selectedStatus: group.producerStatus,
                            isUpdatingStatus: isUpdatingStatus,
                            onSelectStatus: onSelectStatus
                        )
                    } else {
                        producerStatusReadOnlyLabel(selectedStatus: group.producerStatus)
                    }
                }

                horizontalDivider()

                memberLinesSection(group)
            }
            .padding(tokens.spacing.md)
        }
    }

    @ViewBuilder func memberLinesSection(_ group: ReceivedOrdersMemberGroup) -> some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            ForEach(Array(group.lines.enumerated()), id: \.element.id) { _, line in
                memberLineRow(line)
                horizontalDivider(opacity: 0.6)
            }

            Text(
                l10n(
                    AccessL10nKey.receivedOrdersMemberTotalFormat,
                    group.total.euroCurrencyText(locale: presentationLocale)
                )
            )
                .font(receivedOrdersMemberTotalFont)
                .foregroundStyle(tokens.colors.feedbackError)
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
    }

    @ViewBuilder func memberLineRow(_ line: ReceivedOrdersMemberLine) -> some View {
        ViewThatFits(in: .horizontal) {
            wideMemberLineRow(line)
            compactMemberLineRow(line)
        }
    }

    func wideMemberLineRow(_ line: ReceivedOrdersMemberLine) -> some View {
        HStack(alignment: .center, spacing: tokens.spacing.sm) {
            memberProductDescription(line)
            .frame(maxWidth: .infinity, alignment: .leading)

            verticalDivider(height: OrderAdaptiveLayoutMetrics.compactDividerHeight)

            memberQuantityAndSubtotal(line)
            .frame(width: OrderAdaptiveLayoutMetrics.memberAmountColumnWidth)
        }
    }

    func compactMemberLineRow(_ line: ReceivedOrdersMemberLine) -> some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            memberProductDescription(line)
            memberQuantityAndSubtotal(line)
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
    }

    func memberProductDescription(_ line: ReceivedOrdersMemberLine) -> some View {
        VStack(alignment: .leading, spacing: tokens.spacing.xs) {
            Text(line.productName)
                .font(tokens.typography.bodySecondary.weight(.semibold))
                .foregroundStyle(tokens.colors.textPrimary)
                .lineLimit(2)
            Text(line.packagingLine)
                .font(tokens.typography.labelRegular)
                .foregroundStyle(tokens.colors.textSecondary)
                .lineLimit(2)
        }
    }

    func memberQuantityAndSubtotal(_ line: ReceivedOrdersMemberLine) -> some View {
        VStack(alignment: .center, spacing: tokens.spacing.xs) {
            HStack(alignment: .firstTextBaseline, spacing: tokens.spacing.xs) {
                Text(line.quantity.myOrderUiDecimal)
                    .font(receivedOrdersMemberAmountFont)
                    .foregroundStyle(tokens.colors.textPrimary)
                Text("(\(line.totalMeasureLabel()))")
                    .font(receivedOrdersParentheticalFont)
                    .foregroundStyle(tokens.colors.textSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            Text(line.subtotal.euroCurrencyText(locale: presentationLocale))
                .font(receivedOrdersMemberAmountFont)
                .foregroundStyle(tokens.colors.textPrimary)
        }
    }

    func producerStatusHeaderButton(
        selectedStatus: ProducerOrderStatus,
        isUpdatingStatus: Bool,
        onSelectStatus: @escaping (ProducerOrderStatus) -> Void
    ) -> some View {
        let targetStatus = nextProducerStatus(after: selectedStatus)

        return Button {
            if let targetStatus {
                onSelectStatus(targetStatus)
            }
        } label: {
            producerStatusLabel(
                text: isUpdatingStatus
                    ? l10n(AccessL10nKey.receivedOrdersStatusSaving)
                    : localizedProducerOrderStatusTitle(selectedStatus),
                selectedStatus: selectedStatus
            )
        }
        .buttonStyle(.plain)
        .disabled(targetStatus == nil || isUpdatingStatus)
    }

    func producerStatusReadOnlyLabel(selectedStatus: ProducerOrderStatus) -> some View {
        Text(
            l10n(
                AccessL10nKey.receivedOrdersStatusFormat,
                localizedProducerOrderStatusTitle(selectedStatus)
            )
        )
            .font(tokens.typography.labelRegular.weight(.semibold))
            .foregroundStyle(tokens.colors.textSecondary)
            .lineLimit(1)
    }

    func producerStatusLabel(text: String, selectedStatus: ProducerOrderStatus) -> some View {
        let style = receivedOrdersStatusChipStyle(selectedStatus)
        let shape = RoundedRectangle(cornerRadius: tokens.radius.sm, style: .continuous)

        return Text(text)
            .font(tokens.typography.bodySecondary.weight(.semibold))
            .foregroundStyle(tokens.colors.textPrimary)
            .lineLimit(1)
            .padding(.horizontal, tokens.spacing.md)
            .frame(minHeight: tokens.layout.minimumTouchTarget)
            .background(shape.fill(style.container))
            .overlay(shape.stroke(style.border, lineWidth: 1))
    }

    func receivedOrdersStatusChipStyle(_ status: ProducerOrderStatus) -> ProducerStatusVisualStyle {
        switch status {
        case .unread, .read:
            return ProducerStatusVisualStyle(
                container: tokens.colors.surfaceSecondary.opacity(0.82),
                border: tokens.colors.borderSubtle
            )
        case .prepared:
            return ProducerStatusVisualStyle(
                container: tokens.colors.feedbackWarning.opacity(0.16),
                border: tokens.colors.feedbackWarning.opacity(0.65)
            )
        case .delivered:
            return ProducerStatusVisualStyle(
                container: tokens.colors.actionPrimary.opacity(0.28),
                border: tokens.colors.actionPrimary.opacity(0.65)
            )
        }
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
            .frame(width: 1, height: height)
    }

    @ViewBuilder func totalBar(total: Double) -> some View {
        let shape = RoundedRectangle(cornerRadius: tokens.radius.sm, style: .continuous)

        HStack {
            Text(
                l10n(
                    AccessL10nKey.receivedOrdersGeneralTotalFormat,
                    total.euroCurrencyText(locale: presentationLocale)
                )
            )
                .font(receivedOrdersGeneralTotalFont)
                .foregroundStyle(tokens.colors.actionOnPrimary)
                .frame(maxWidth: .infinity, alignment: .center)
                .minimumScaleFactor(0.86)
        }
        .padding(.horizontal, tokens.spacing.md)
        .frame(minHeight: tokens.layout.minimumTouchTarget)
        .background(shape.fill(tokens.colors.actionPrimary))
        .overlay(
            shape.stroke(tokens.colors.borderSubtle.opacity(0.65), lineWidth: 1)
        )
        .clipShape(shape)
        .padding(.horizontal, tokens.spacing.sm)
        .padding(.bottom, tokens.spacing.sm)
        .allowsHitTesting(false)
    }

    @ViewBuilder func receivedOrdersProductImage(urlString: String?) -> some View {
        let imageSize = OrderAdaptiveLayoutMetrics.compactProductImageSize
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
