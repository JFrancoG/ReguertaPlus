import SwiftUI

extension MyOrderRouteView {
    var confirmedOrderView: some View {
        ZStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                VStack(alignment: .trailing, spacing: tokens.spacing.xs) {
                    reguertaButton(
                        LocalizedStringKey(AccessL10nKey.myOrderEditConfirmedAction),
                        fullWidth: false,
                        fixedWidth: tokens.button.dialogTwoButtonsWidth
                    ) {
                        viewModel.editConfirmedOrder()
                    }

                    Text(LocalizedStringKey(AccessL10nKey.myOrderEditableUntilSundayNote))
                        .font(tokens.typography.labelRegular)
                        .foregroundStyle(tokens.colors.textSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .trailing)

                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: tokens.spacing.md) {
                        ForEach(viewModel.confirmedOrderGroups) { group in
                            confirmedProducerCard(group)
                        }
                    }
                    .padding(.bottom, orderTotalBarScrollBottomPadding)
                }
                .ignoresSafeArea(.container, edges: .bottom)
            }

            orderTotalBar(
                l10n(
                    AccessL10nKey.myOrderConfirmedTotalFormat,
                    viewModel.cartTotal.euroCurrencyText(locale: presentationLocale)
                )
            )
                .accessibilityIdentifier("myOrder.confirmedTotalBar")
        }
    }

    @ViewBuilder
    var previousOrderView: some View {
        ZStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                switch viewModel.previousOrderState {
                case .loading:
                    reguertaCard {
                        HStack(spacing: tokens.spacing.sm) {
                            ProgressView()
                                .tint(tokens.colors.actionPrimary)
                            Text(LocalizedStringKey(AccessL10nKey.myOrderPreviousLoading))
                                .font(tokens.typography.bodySecondary)
                                .foregroundStyle(tokens.colors.textSecondary)
                        }
                    }

                case .empty:
                    Text(LocalizedStringKey(AccessL10nKey.myOrderPreviousEmpty))
                        .font(tokens.typography.body)
                        .foregroundStyle(tokens.colors.feedbackError)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.horizontal, tokens.spacing.lg)
                        .padding(.vertical, tokens.spacing.xl)

                case .error:
                    reguertaCard {
                        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                            Text(LocalizedStringKey(AccessL10nKey.myOrderPreviousError))
                                .font(tokens.typography.bodySecondary)
                                .foregroundStyle(tokens.colors.textSecondary)
                            reguertaButton(
                                LocalizedStringKey(AccessL10nKey.myOrderPreviousRetry),
                                variant: .text,
                                fullWidth: false
                            ) {
                                Task {
                                    await viewModel.retryPreviousOrder()
                                }
                            }
                        }
                    }

                case .loaded(let snapshot):
                    ScrollView(.vertical, showsIndicators: false) {
                        VStack(spacing: tokens.spacing.md) {
                            ForEach(snapshot.groups) { group in
                                previousProducerCard(group)
                            }
                        }
                        .padding(.bottom, orderTotalBarScrollBottomPadding)
                    }
                    .ignoresSafeArea(.container, edges: .bottom)
                }
            }

            if case .loaded(let snapshot) = viewModel.previousOrderState {
                orderTotalBar(
                    l10n(
                        AccessL10nKey.myOrderConfirmedTotalFormat,
                        snapshot.total.euroCurrencyText(locale: presentationLocale)
                    )
                )
                    .accessibilityIdentifier("myOrder.previousTotalBar")
            }
        }
    }

    func confirmedProducerCard(_ group: MyOrderConfirmedGroup) -> some View {
        PersonalOrderSummaryProducerCard(
            tokens: tokens,
            companyName: group.companyName,
            statusText: localizedProducerOrderStatusTitle(group.producerStatus),
            lines: group.lines.map { line in
                PersonalOrderSummaryLineContent(
                    id: line.id,
                    productName: line.product.name,
                    packagingLine: viewModel.packContainerLine(for: line.product),
                    quantityText: confirmedQuantityLabel(for: line),
                    subtotalText: line.subtotal.euroCurrencyText(locale: presentationLocale)
                )
            },
            totalText: l10n(
                AccessL10nKey.myOrderProducerSubtotalFormat,
                group.subtotal.euroCurrencyText(locale: presentationLocale)
            )
        )
    }

    func previousProducerCard(_ group: MyOrderPreviousOrderGroup) -> some View {
        PersonalOrderSummaryProducerCard(
            tokens: tokens,
            companyName: group.companyName,
            statusText: nil,
            lines: group.lines.map { line in
                PersonalOrderSummaryLineContent(
                    id: line.id,
                    productName: line.productName,
                    packagingLine: line.packagingLine,
                    quantityText: localizedGenericOrderHistoryQuantityLabel(
                        line.quantityLabel,
                        singleLabel: l10n(AccessL10nKey.myOrderQuantitySingle),
                        pluralFormat: l10n(AccessL10nKey.myOrderQuantityPluralFormat)
                    ),
                    subtotalText: line.subtotal.euroCurrencyText(locale: presentationLocale)
                )
            },
            totalText: l10n(
                AccessL10nKey.myOrderProducerSubtotalFormat,
                group.subtotal.euroCurrencyText(locale: presentationLocale)
            )
        )
    }

    func confirmedQuantityLabel(for line: MyOrderConfirmedLine) -> String {
        if line.product.pricingMode == .weight {
            let unitLabel = line.product.unitAbbreviation ?? line.product.unitName
            return "\(line.quantityAtOrder.myOrderUiDecimal) \(unitLabel)"
        }
        if line.unitsSelected == 1 {
            return l10n(AccessL10nKey.myOrderQuantitySingle)
        }
        return l10n(AccessL10nKey.myOrderQuantityPluralFormat, line.unitsSelected)
    }

    func orderTotalBar(_ text: String) -> some View {
        let shape = RoundedRectangle(cornerRadius: 8.resize, style: .continuous)

        return HStack {
            Text(text)
                .font(tokens.typography.body.weight(.semibold))
                .foregroundStyle(tokens.colors.textPrimary)
                .frame(maxWidth: .infinity)
        }
        .padding(.horizontal, tokens.spacing.md)
        .frame(height: 44.resize)
        .background(shape.fill(tokens.colors.actionPrimary.opacity(0.7)))
        .overlay(
            shape.stroke(tokens.colors.borderSubtle.opacity(0.65), lineWidth: 1.resize)
        )
        .clipShape(shape)
        .padding(.horizontal, tokens.spacing.sm)
        .padding(.bottom, 8.resizeBottomSize)
        .allowsHitTesting(false)
    }

    var orderTotalBarScrollBottomPadding: CGFloat {
        72.resize + 8.resizeBottomSize
    }

    var loadingState: some View {
        ProgressView()
            .controlSize(.large)
            .tint(tokens.colors.actionPrimary)
            .scaleEffect(1.24)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
    }

    var emptyState: some View {
        reguertaCard {
            Text(LocalizedStringKey(AccessL10nKey.myOrderListEmpty))
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.textSecondary)
        }
    }

    var productsList: some View {
        ScrollView(.vertical, showsIndicators: false) {
            LazyVStack(alignment: .leading, spacing: tokens.spacing.md, pinnedViews: [.sectionHeaders]) {
                ForEach(viewModel.groupedProducts) { group in
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
            .padding(.bottom, 88.resize)
        }
        .scrollClipDisabled(!viewModel.isCartVisible)
        .scrollDismissesKeyboard(.interactively)
        .ignoresSafeArea(.container, edges: .bottom)
    }

    @ViewBuilder
    func producerHeader(_ group: MyOrderProducerGroup) -> some View {
        HStack(spacing: tokens.spacing.sm) {
            Spacer(minLength: 0)
            Text(group.companyName)
                .font(tokens.typography.titleCard.weight(.semibold))
                .foregroundStyle(tokens.colors.actionPrimary)
            if group.isCommittedEcoBasketProducer {
                badge(LocalizedStringKey(AccessL10nKey.myOrderBadgeCommittedEcoProducer))
            }
            if group.isCommonPurchasesGroup {
                badge(
                    LocalizedStringKey(AccessL10nKey.myOrderBadgeCommonPurchase),
                    usesCompactFont: true
                )
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, tokens.spacing.sm)
        .padding(.horizontal, tokens.spacing.lg)
        .frame(maxWidth: .infinity)
        .background {
            tokens.colors.surfaceSecondary
                .padding(.horizontal, 0)
        }
    }

    @ViewBuilder
    func productCard(_ product: Product) -> some View {
        let quantity = viewModel.quantity(for: product)
        let stockLabel = stockLabel(for: product)

        reguertaListItemCard {
            VStack(alignment: .leading, spacing: 0) {
                Spacer().frame(height: 16.resize)
                ZStack(alignment: .topTrailing) {
                    HStack {
                        productImage(product)
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, 12.resize)

                    quantityControls(
                        product: product,
                        quantity: quantity,
                        isEditable: !viewModel.isReadOnlyMode
                    )
                    .padding(.trailing, 12.resize)
                }

                Spacer().frame(height: 8.resize)

                VStack(alignment: .leading, spacing: 4.resize) {
                    Text(product.name)
                        .font(tokens.typography.body.weight(.semibold))
                        .foregroundStyle(tokens.colors.textPrimary)
                        .lineLimit(2)

                    if product.description.isNotEmpty {
                        Text(product.description)
                            .font(tokens.typography.bodySecondary)
                            .foregroundStyle(tokens.colors.textSecondary)
                            .lineLimit(2)
                    }

                    Text(viewModel.packContainerLine(for: product))
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)

                    HStack(alignment: .firstTextBaseline) {
                        Text(productPriceText(product))
                            .font(tokens.typography.body.weight(.semibold))
                            .foregroundStyle(tokens.colors.textPrimary)
                        Spacer()
                        if let stockLabel {
                            Text(stockLabel.text)
                                .font(tokens.typography.bodySecondary.weight(.semibold))
                                .foregroundStyle(stockLabel.color)
                        }
                    }
                }
                .padding(.horizontal, 12.resize)
                Spacer().frame(height: 16.resize)
            }
        }
    }

    @ViewBuilder
    func productImage(_ product: Product) -> some View {
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
            .clipShape(RoundedRectangle(cornerRadius: 8.resize))
        } else {
            Image("product_no_available")
                .resizable()
                .scaledToFill()
                .frame(width: imageSize, height: imageSize)
                .clipShape(RoundedRectangle(cornerRadius: 8.resize))
        }
    }

    @ViewBuilder
    func quantityControls(
        product: Product,
        quantity: Int,
        isEditable: Bool
    ) -> some View {
        if !isEditable {
            readOnlyQuantityControls(product: product, quantity: quantity)
        } else if quantity == 0 {
            addQuantityButton(product: product, quantity: quantity)
        } else {
            editableQuantityControls(product: product, quantity: quantity)
        }
    }

    @ViewBuilder
    func readOnlyQuantityControls(product: Product, quantity: Int) -> some View {
        if quantity > 0 {
            Text(quantityUnitText(product: product, quantity: quantity))
                .font(tokens.typography.body.weight(.semibold))
                .foregroundStyle(tokens.colors.textPrimary)
        }
    }

    func addQuantityButton(product: Product, quantity: Int) -> some View {
        let canIncreaseQuantity = viewModel.canIncrease(product: product, currentQuantity: quantity)
        return Button {
            viewModel.increase(product)
        } label: {
            HStack(spacing: tokens.spacing.xs) {
                Text(LocalizedStringKey(AccessL10nKey.myOrderAddAction))
                    .font(tokens.typography.body.weight(.semibold))
                Image(systemName: "cart.badge.plus")
                    .font(.system(size: 24.resize, weight: .semibold))
            }
            .foregroundStyle(canIncreaseQuantity ? tokens.colors.actionOnPrimary : tokens.colors.textSecondary)
            .padding(.horizontal, 14.resize)
            .frame(height: 44.resize)
            .background(canIncreaseQuantity ? tokens.colors.actionPrimary : Color(.systemGray5))
            .clipShape(RoundedRectangle(cornerRadius: 12.resize))
        }
        .buttonStyle(.plain)
        .disabled(!canIncreaseQuantity)
    }

    func editableQuantityControls(product: Product, quantity: Int) -> some View {
        let canIncreaseQuantity = viewModel.canIncrease(product: product, currentQuantity: quantity)
        return HStack(spacing: tokens.spacing.sm) {
            Text(quantityUnitText(product: product, quantity: quantity))
                .font(tokens.typography.body.weight(.semibold))
                .foregroundStyle(tokens.colors.textPrimary)

            ReguertaListActionIconButton(
                systemImageName: quantity <= product.minimumSelectionCount ? "trash" : "minus",
                accessibilityLabel: l10n(AccessL10nKey.myOrderDecreaseAction),
                backgroundColor: tokens.colors.feedbackError,
                action: { viewModel.decrease(product) }
            )

            ReguertaListActionIconButton(
                systemImageName: "plus",
                accessibilityLabel: l10n(AccessL10nKey.myOrderIncreaseAction),
                backgroundColor: tokens.colors.actionPrimary,
                isEnabled: canIncreaseQuantity,
                action: { viewModel.increase(product) }
            )
        }
    }

    func quantityUnitText(product: Product, quantity: Int) -> String {
        if product.pricingMode == .weight {
            return l10n(
                AccessL10nKey.myOrderQuantityWeightFormat,
                product.selectedQuantity(selectionCount: quantity).myOrderUiDecimal,
                "kg"
            )
        }
        if quantity == 1 {
            return l10n(AccessL10nKey.myOrderQuantitySingle)
        }
        return l10n(AccessL10nKey.myOrderQuantityPluralFormat, quantity)
    }

    func productPriceText(_ product: Product) -> String {
        l10n(
            product.pricingMode == .weight
                ? AccessL10nKey.myOrderPricePerKgFormat
                : AccessL10nKey.myOrderPricePerUnitFormat,
            product.price.euroCurrencyText(locale: presentationLocale)
        )
    }

}
