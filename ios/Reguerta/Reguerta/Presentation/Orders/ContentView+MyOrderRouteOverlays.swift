import SwiftUI

extension MyOrderRouteView {
    var searchOverlay: some View {
        let shape = Capsule()

        return searchOverlayContent
            .background {
                if #available(iOS 26.0, *) {
                    shape
                        .fill(tokens.colors.surfacePrimary.opacity(0.18))
                        .glassEffect(
                            .regular
                                .tint(tokens.colors.surfaceSecondary.opacity(0.18))
                                .interactive(true),
                            in: shape
                        )
                } else {
                    shape
                        .fill(.ultraThinMaterial)
                }
            }
            .overlay(
                shape.stroke(tokens.colors.borderSubtle.opacity(0.58), lineWidth: 1.resize)
            )
            .shadow(color: .black.opacity(0.16), radius: 18.resize, y: 8.resize)
            .padding(.horizontal, tokens.spacing.md)
            .padding(.bottom, 8.resizeBottomSize)
    }

    var searchOverlayContent: some View {
        HStack(spacing: tokens.spacing.sm) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 23.resize, weight: .medium))
                .foregroundStyle(tokens.colors.textSecondary)
            TextField(
                "Buscar productos",
                text: Binding(
                    get: { viewModel.searchQuery },
                    set: { viewModel.searchQuery = $0 }
                )
            )
                .font(tokens.typography.titleCard)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .accessibilityIdentifier("myOrder.searchField")
            if viewModel.searchQuery.isNotEmpty {
                Button {
                    viewModel.clearSearch()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(tokens.colors.textSecondary)
                }
                .buttonStyle(.plain)
            }
        }
        .frame(minHeight: 58.resize)
        .padding(.horizontal, tokens.spacing.lg)
        .contentShape(Capsule())
    }

    var cartOverlay: some View {
        ZStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                cartOverlayHeader
                cartOverlayProductsList

                Spacer(minLength: 0)
            }
            .padding(.top, 0)
            .padding(.bottom, tokens.spacing.md)
            .padding(.horizontal, tokens.spacing.lg)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)

            cartOverlayCheckoutFooter
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background {
            tokens.colors.surfacePrimary
                .ignoresSafeArea(.container, edges: .bottom)
                .padding(.horizontal, -myOrderScreenHorizontalBleed)
        }
        .allowsHitTesting(viewModel.isCartVisible)
        .accessibilityIdentifier("myOrder.cartOverlay")
    }

    var cartOverlayHeader: some View {
        HStack(spacing: tokens.spacing.sm) {
            Spacer(minLength: 0)
            Text("Total: \(viewModel.cartTotal.euroCurrencyText())")
                .font(tokens.typography.titleCard.weight(.semibold))
                .foregroundStyle(tokens.colors.actionPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.78)
        }
    }

    var cartOverlayProductsList: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(spacing: tokens.spacing.sm) {
                ForEach(viewModel.selectedProducts) { product in
                    selectedProductCard(product)
                }
            }
            .padding(.bottom, 88.resize)
        }
        .ignoresSafeArea(.container, edges: .bottom)
    }

    @ViewBuilder
    var cartOverlayCheckoutFooter: some View {
        if !viewModel.isReadOnlyConfirmedView {
            reguertaFloatingActionButton(
                verbatim: viewModel.finalizeCheckoutTitle,
                isEnabled: viewModel.canSubmitCheckout,
                accessibilityIdentifier: "myOrder.checkoutButton"
            ) {
                Task {
                    await viewModel.validateCheckout()
                }
            }
        }
    }

    func closeCartOverlay() {
        withAnimation(myOrderCartOverlayAnimation) {
            viewModel.closeCartOverlay()
        }
    }

    @ViewBuilder
    func selectedProductCard(_ product: Product) -> some View {
        let quantity = viewModel.quantity(for: product)
        let selectedOption = viewModel.selectedEcoBasketOption(for: product)

        reguertaListItemCard {
            VStack(alignment: .leading, spacing: 0) {
                Spacer().frame(height: 16.resize)
                HStack(alignment: .top, spacing: tokens.spacing.sm) {
                    productImage(product)
                    VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                        Text(product.name)
                            .font(tokens.typography.body.weight(.semibold))
                            .foregroundStyle(tokens.colors.textPrimary)
                            .lineLimit(2)
                        Text("\(product.price.euroCurrencyText()) / ud.")
                            .font(tokens.typography.bodySecondary)
                            .foregroundStyle(tokens.colors.textSecondary)
                    }
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 12.resize)

                Spacer().frame(height: 12.resize)

                quantityControls(
                    product: product,
                    quantity: quantity,
                    isEditable: !viewModel.isReadOnlyMode
                )
                .frame(maxWidth: .infinity, alignment: .trailing)
                .padding(.horizontal, 12.resize)

                if product.isEcoBasket, quantity > 0, !viewModel.isReadOnlyMode {
                    Spacer().frame(height: 12.resize)
                    ecoBasketOptionSelector(
                        selectedOption: selectedOption,
                        onOptionSelected: { option in
                            viewModel.selectEcoBasketOption(productId: product.id, option: option)
                        }
                    )
                    .padding(.horizontal, 12.resize)
                }
                Spacer().frame(height: 16.resize)
            }
        }
    }

    @ViewBuilder
    func checkoutDialog(_ alert: MyOrderCheckoutAlert) -> some View {
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
            reguertaDialog(
                type: .info,
                title: "Pedido realizado con éxito",
                message: noPickupEcoBaskets > 0
                    ? "Todo correcto. Total: \(total.euroCurrencyText()). Ecocestas marcadas como no_pickup: \(noPickupEcoBaskets). Tu pedido se ha guardado."
                    : "Todo correcto. Total: \(total.euroCurrencyText()). Tu pedido se ha guardado.",
                primaryAction: ReguertaDialogAction(
                    title: "Aceptar",
                    action: handleCheckoutSuccessAcknowledged
                ),
                dismissible: false
            )
        }
    }

    func checkoutErrorDialog(title: String, message: String) -> some View {
        reguertaDialog(
            type: .error,
            title: title,
            message: message,
            primaryAction: ReguertaDialogAction(
                title: "Aceptar",
                action: viewModel.dismissCheckoutAlert
            ),
            onDismiss: viewModel.dismissCheckoutAlert
        )
    }

    func handleCheckoutSuccessAcknowledged() {
        viewModel.acknowledgeCheckoutSuccess()
        onCheckoutSuccessAcknowledge()
    }

    func stockLabel(for product: Product) -> (text: String, color: Color)? {
        guard product.stockMode == .finite else { return nil }
        let stock = max(0, product.stockQty ?? 0)
        guard stock > 0 else {
            return ("Sin Stock", tokens.colors.feedbackError)
        }
        guard stock < 20 else { return nil }
        return (
            "Quedan: \(stock.myOrderUiDecimal) uds.",
            stock < 10 ? tokens.colors.feedbackWarning : tokens.colors.actionPrimary
        )
    }

    @ViewBuilder
    func ecoBasketOptionSelector(
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
    func ecoBasketOptionButton(
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
    func badge(_ title: String) -> some View {
        Text(title)
            .font(tokens.typography.label)
            .foregroundStyle(tokens.colors.actionPrimary)
            .padding(.horizontal, tokens.spacing.sm)
            .padding(.vertical, tokens.spacing.xs)
            .background(tokens.colors.actionPrimary.opacity(0.12))
            .clipShape(Capsule())
    }
}
