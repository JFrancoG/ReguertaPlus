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
            .padding(.bottom, tokens.spacing.md)
    }

    var searchOverlayContent: some View {
        HStack(spacing: tokens.spacing.sm) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 23.resize, weight: .medium))
                .foregroundStyle(tokens.colors.textSecondary)
            TextField("Buscar productos", text: $searchQuery)
                .font(tokens.typography.titleCard)
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
        .frame(minHeight: 58.resize)
        .padding(.horizontal, tokens.spacing.lg)
        .contentShape(Capsule())
    }

    @ViewBuilder
    func cartOverlay(proxy: GeometryProxy) -> some View {
        let panelWidth = proxy.size.width

        HStack {
            Spacer(minLength: 0)
            ZStack(alignment: .bottom) {
                tokens.colors.surfacePrimary

                VStack(alignment: .leading, spacing: tokens.spacing.md) {
                    cartOverlayHeader
                    cartOverlayProductsList

                    Spacer(minLength: 0)
                }
                .padding(.top, tokens.spacing.xs)
                .padding(.bottom, tokens.spacing.md)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)

                cartOverlayCheckoutFooter
            }
            .frame(width: panelWidth)
            .frame(maxHeight: .infinity, alignment: .top)
            .offset(x: isCartVisible ? 0 : panelWidth + 24.resize)
            .animation(.easeInOut(duration: 0.22), value: isCartVisible)
        }
        .allowsHitTesting(isCartVisible)
    }

    var cartOverlayHeader: some View {
        HStack(spacing: tokens.spacing.sm) {
            Text("Mi carrito")
                .font(tokens.typography.titleSection)
                .foregroundStyle(tokens.colors.textPrimary)
                .lineLimit(1)
            Spacer()
            Text("Total: \(cartTotal.myOrderUiDecimal) €")
                .font(tokens.typography.titleCard.weight(.semibold))
                .foregroundStyle(tokens.colors.actionPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.78)
        }
    }

    var cartOverlayProductsList: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(spacing: tokens.spacing.sm) {
                ForEach(selectedProducts) { product in
                    selectedProductCard(product)
                }
            }
            .padding(.bottom, 116.resize)
        }
    }

    @ViewBuilder
    var cartOverlayCheckoutFooter: some View {
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
            .frame(maxWidth: .infinity)
            .background(tokens.colors.surfaceSecondary.opacity(0.96))
            .overlay(alignment: .top) {
                Rectangle()
                    .fill(tokens.colors.borderSubtle.opacity(0.8))
                    .frame(height: 1.resize)
            }
            .shadow(color: .black.opacity(0.12), radius: 10.resize, y: -3.resize)
        }
    }

    func closeCartOverlay() {
        if isReadOnlyConfirmedView {
            isViewingConfirmedOrder = false
        }
        withAnimation(.easeInOut(duration: 0.22)) {
            isCartVisible = false
        }
    }

    @ViewBuilder
    func selectedProductCard(_ product: Product) -> some View {
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

    func validateCheckout() {
        let validation = validateMyOrderCheckout(
            currentMember: currentMember,
            members: members,
            products: products,
            seasonalCommitments: seasonalCommitments,
            selectedQuantities: selectedQuantities,
            selectedEcoBasketOptions: selectedEcoBasketOptions,
            currentWeekParity: currentWeekParity
        )
        if let alert = checkoutAlertForValidation(validation) {
            checkoutAlert = alert
            return
        }
        submitValidatedCheckout()
    }

    func checkoutAlertForValidation(
        _ validation: MyOrderCheckoutValidationResult
    ) -> MyOrderCheckoutAlert? {
        if validation.hasEcoBasketPriceMismatch {
            return .ecoBasketPriceMismatch
        }
        if !validation.incompatibleCommitmentProductNames.isEmpty {
            return .incompatibleCommitments(validation.incompatibleCommitmentProductNames)
        }
        if !validation.missingCommitmentProductNames.isEmpty {
            return .missingCommitments(validation.missingCommitmentProductNames)
        }
        if !validation.exceededCommitmentProductNames.isEmpty {
            return .exceededCommitments(validation.exceededCommitmentProductNames)
        }
        return nil
    }

    func submitValidatedCheckout() {
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
            applySuccessfulCheckoutState()
        }
    }

    func applySuccessfulCheckoutState() {
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

    func checkoutErrorDialog(title: String, message: String) -> some View {
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

    func handleCheckoutSuccessAcknowledged() {
        checkoutAlert = nil
        isCartVisible = false
        onCheckoutSuccessAcknowledge()
    }

    func packContainerLine(for product: Product) -> String {
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

    func finiteStockLimit(for product: Product) -> Int? {
        guard product.stockMode == .finite else { return nil }
        let stock = max(0, product.stockQty ?? 0)
        return Int(stock.rounded(.down))
    }

    func canIncrease(product: Product, currentQuantity: Int) -> Bool {
        if let commitmentLimit = seasonalCommitmentUnitLimitsByProductId[product.id],
           currentQuantity >= commitmentLimit {
            return false
        }
        guard let finiteLimit = finiteStockLimit(for: product) else { return true }
        return currentQuantity < finiteLimit
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

    func increase(_ product: Product) {
        guard !isReadOnlyMode else { return }
        let currentQuantity = selectedQuantities[product.id, default: 0]
        guard canIncrease(product: product, currentQuantity: currentQuantity) else { return }
        selectedQuantities[product.id] = currentQuantity + 1
        if product.isEcoBasket, selectedEcoBasketOptions[product.id] == nil {
            selectedEcoBasketOptions[product.id] = ecoBasketOptionPickup
        }
    }

    func decrease(_ product: Product) {
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
