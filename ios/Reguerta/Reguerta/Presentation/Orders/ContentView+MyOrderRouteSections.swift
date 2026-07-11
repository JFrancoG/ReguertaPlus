import SwiftUI

extension MyOrderRouteView {
    var confirmedOrderView: some View {
        ZStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                HStack(spacing: tokens.spacing.sm) {
                    Text("Pedido confirmado")
                        .font(tokens.typography.titleCard.weight(.semibold))
                        .foregroundStyle(tokens.colors.textPrimary)
                    Spacer()
                    Button {
                        viewModel.editConfirmedOrder()
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
                        ForEach(viewModel.confirmedOrderGroups) { group in
                            confirmedProducerCard(group)
                        }
                    }
                    .padding(.bottom, orderTotalBarScrollBottomPadding)
                }
                .ignoresSafeArea(.container, edges: .bottom)
            }

            orderTotalBar("Suma total pedido: \(viewModel.cartTotal.euroCurrencyText())")
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
                            Text("Cargando pedido de la semana anterior…")
                                .font(tokens.typography.bodySecondary)
                                .foregroundStyle(tokens.colors.textSecondary)
                        }
                    }

                case .empty:
                    Text("No hay ningún pedido registrado la semana pasada")
                        .font(tokens.typography.body)
                        .foregroundStyle(tokens.colors.feedbackError)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.horizontal, tokens.spacing.lg)
                        .padding(.vertical, tokens.spacing.xl)

                case .error:
                    reguertaCard {
                        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                            Text("No hemos podido cargar tu pedido anterior.")
                                .font(tokens.typography.bodySecondary)
                                .foregroundStyle(tokens.colors.textSecondary)
                            reguertaButton("Reintentar", variant: .text, fullWidth: false) {
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
                orderTotalBar("Suma total pedido: \(snapshot.total.euroCurrencyText())")
                    .accessibilityIdentifier("myOrder.previousTotalBar")
            }
        }
    }

    @ViewBuilder
    func confirmedProducerCard(_ group: MyOrderConfirmedGroup) -> some View {
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

            Divider()
                .overlay(tokens.colors.borderSubtle)

            confirmedProducerLinesSection(group)
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
    func confirmedProducerLinesSection(_ group: MyOrderConfirmedGroup) -> some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            ForEach(group.lines) { line in
                confirmedProducerLineRow(line)
            }

            Divider()
                .overlay(tokens.colors.borderSubtle)

            HStack {
                Spacer()
                Text("Total: \(group.subtotal.euroCurrencyText())")
                    .font(tokens.typography.body.weight(.semibold))
                    .foregroundStyle(Color(red: 0.78, green: 0.38, blue: 0.36))
            }
        }
    }

    @ViewBuilder
    func confirmedProducerLineRow(_ line: MyOrderConfirmedLine) -> some View {
        VStack(alignment: .leading, spacing: tokens.spacing.xs) {
            HStack(alignment: .firstTextBaseline, spacing: tokens.spacing.sm) {
                VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                    Text(line.product.name)
                        .font(tokens.typography.body.weight(.semibold))
                        .foregroundStyle(tokens.colors.textPrimary)
                    Text(viewModel.packContainerLine(for: line.product))
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)
                }
                Spacer()
                Text(confirmedQuantityLabel(for: line))
                    .font(tokens.typography.body.weight(.semibold))
                    .foregroundStyle(tokens.colors.textPrimary)
                Text(line.subtotal.euroCurrencyText())
                    .font(tokens.typography.body.weight(.semibold))
                    .foregroundStyle(tokens.colors.textPrimary)
            }
        }
    }

    @ViewBuilder
    func previousProducerCard(_ group: MyOrderPreviousOrderGroup) -> some View {
        reguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(group.companyName)
                    .font(tokens.typography.titleCard.weight(.semibold))
                    .foregroundStyle(tokens.colors.actionPrimary)

                Divider()
                    .overlay(tokens.colors.borderSubtle)

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
                            Text(line.subtotal.euroCurrencyText())
                                .font(tokens.typography.body.weight(.semibold))
                                .foregroundStyle(tokens.colors.textPrimary)
                        }
                    }
                }

                Divider()
                    .overlay(tokens.colors.borderSubtle)

                HStack {
                    Spacer()
                    Text("Total: \(group.subtotal.euroCurrencyText())")
                        .font(tokens.typography.body.weight(.semibold))
                        .foregroundStyle(Color(red: 0.78, green: 0.38, blue: 0.36))
                }
            }
        }
    }

    func confirmedQuantityLabel(for line: MyOrderConfirmedLine) -> String {
        if line.product.pricingMode == .weight {
            let unitLabel = line.product.unitAbbreviation ?? line.product.unitName
            return "\(line.quantityAtOrder.myOrderUiDecimal) \(unitLabel)"
        }
        return "\(line.unitsSelected) \(line.unitsSelected == 1 ? "ud." : "uds.")"
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
                badge("Compromiso ecocesta")
            }
            if group.isCommonPurchasesGroup {
                badge("Compra común")
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
                Text("Añadir")
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
                accessibilityLabel: "Quitar producto",
                backgroundColor: tokens.colors.feedbackError,
                action: { viewModel.decrease(product) }
            )

            ReguertaListActionIconButton(
                systemImageName: "plus",
                accessibilityLabel: "Añadir producto",
                backgroundColor: tokens.colors.actionPrimary,
                isEnabled: canIncreaseQuantity,
                action: { viewModel.increase(product) }
            )
        }
    }

    func quantityUnitText(product: Product, quantity: Int) -> String {
        if product.pricingMode == .weight {
            return "\(product.selectedQuantity(selectionCount: quantity).myOrderUiDecimal) kg"
        }
        return "\(quantity) \(quantity == 1 ? "ud." : "uds.")"
    }

    func productPriceText(_ product: Product) -> String {
        let unit = product.pricingMode == .weight ? "kg" : "ud."
        return "\(product.price.euroCurrencyText()) / \(unit)"
    }
}
