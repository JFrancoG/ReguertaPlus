import SwiftUI

struct ProductsRouteView: View {
    let tokens: ReguertaDesignTokens
    let viewModel: SessionViewModel
    let currentHomeMember: Member?
    @Binding var pendingProducerCatalogVisibility: Bool?
    private var activeProducts: [Product] {
        viewModel.productsFeed.filter { !$0.archived }
    }
    private var archivedProducts: [Product] {
        viewModel.productsFeed.filter(\.archived)
    }
    private var isEditing: Bool {
        viewModel.editingProductId != nil
    }
    private var isProducer: Bool {
        currentHomeMember?.isProducer == true
    }
    private var canManageEcoBasket: Bool {
        isProducer
    }
    private var canManageCommonPurchase: Bool {
        currentHomeMember?.isCommonPurchaseManager == true && !isProducer
    }

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }

    var body: some View {
        Group {
            if isEditing {
                ProductEditorCardView(
                    tokens: tokens,
                    viewModel: viewModel,
                    canManageEcoBasket: canManageEcoBasket,
                    canManageCommonPurchase: canManageCommonPurchase
                )
            } else {
                ProductsListRouteView(
                    tokens: tokens,
                    viewModel: viewModel,
                    currentHomeMember: currentHomeMember,
                    activeProducts: activeProducts,
                    archivedProducts: archivedProducts,
                    pendingProducerCatalogVisibility: $pendingProducerCatalogVisibility
                )
            }
        }
        .alert(
            localizedKey(
                pendingProducerCatalogVisibility == true
                    ? AccessL10nKey.productsCatalogVisibilityAlertTitleReactivate
                    : AccessL10nKey.productsCatalogVisibilityAlertTitlePause
            ),
            isPresented: Binding(
                get: { pendingProducerCatalogVisibility != nil },
                set: { presented in
                    if !presented {
                        pendingProducerCatalogVisibility = nil
                    }
                }
            ),
            presenting: pendingProducerCatalogVisibility
        ) { isEnabled in
            Button(localizedKey(AccessL10nKey.commonActionCancel), role: .cancel) {
                pendingProducerCatalogVisibility = nil
            }
            Button(localizedKey(AccessL10nKey.commonActionConfirm)) {
                viewModel.setOwnProducerCatalogVisibility(isEnabled: isEnabled) {
                    pendingProducerCatalogVisibility = nil
                }
            }
        } message: { isEnabled in
            Text(
                isEnabled
                ? localizedKey(AccessL10nKey.productsCatalogVisibilityAlertMessageReactivate)
                : localizedKey(AccessL10nKey.productsCatalogVisibilityAlertMessagePause)
            )
        }
    }
}

private struct ProductEditorCardView: View {
    let tokens: ReguertaDesignTokens
    let viewModel: SessionViewModel
    let canManageEcoBasket: Bool
    let canManageCommonPurchase: Bool

    var body: some View {
        ReguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                Text(
                    viewModel.editingProductId?.isEmpty == false
                        ? localizedKey(AccessL10nKey.productsEditorTitleEdit)
                        : localizedKey(AccessL10nKey.productsEditorTitleNew)
                )
                    .font(tokens.typography.titleCard)
                RoundedRectangle(cornerRadius: 24.resize)
                    .fill(tokens.colors.surfaceSecondary)
                    .frame(width: 112.resize, height: 112.resize)
                    .overlay {
                        Image(systemName: "photo")
                            .font(.system(size: 34.resize))
                            .foregroundStyle(tokens.colors.textSecondary)
                    }
                Text(localizedKey(AccessL10nKey.productsEditorPlaceholderNotice))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)

                TextField(localizedKey(AccessL10nKey.productsEditorFieldName), text: draftStringBinding(\.name))
                    .textFieldStyle(.roundedBorder)

                TextField(localizedKey(AccessL10nKey.productsEditorFieldDescription), text: draftStringBinding(\.description), axis: .vertical)
                    .textFieldStyle(.roundedBorder)

                HStack(spacing: tokens.spacing.sm) {
                    TextField(localizedKey(AccessL10nKey.productsEditorFieldPackContainerQty), text: draftStringBinding(\.packContainerQty))
                        .textFieldStyle(.roundedBorder)
                    TextField(localizedKey(AccessL10nKey.productsEditorFieldPackContainerName), text: draftStringBinding(\.packContainerName))
                        .textFieldStyle(.roundedBorder)
                }

                HStack(spacing: tokens.spacing.sm) {
                    TextField(localizedKey(AccessL10nKey.productsEditorFieldUnitQty), text: draftStringBinding(\.unitQty))
                        .textFieldStyle(.roundedBorder)
                    TextField(localizedKey(AccessL10nKey.productsEditorFieldUnitName), text: draftStringBinding(\.unitName))
                        .textFieldStyle(.roundedBorder)
                }

                HStack(spacing: tokens.spacing.sm) {
                    TextField(localizedKey(AccessL10nKey.productsEditorFieldPackContainerPlural), text: draftStringBinding(\.packContainerPlural))
                        .textFieldStyle(.roundedBorder)
                    TextField(localizedKey(AccessL10nKey.productsEditorFieldUnitPlural), text: draftStringBinding(\.unitPlural))
                        .textFieldStyle(.roundedBorder)
                }

                HStack(spacing: tokens.spacing.sm) {
                    TextField(localizedKey(AccessL10nKey.productsEditorFieldPriceEur), text: draftStringBinding(\.price))
                        .textFieldStyle(.roundedBorder)

                    TextField(localizedKey(AccessL10nKey.productsEditorFieldStock), text: draftStringBinding(\.stockQty))
                        .textFieldStyle(.roundedBorder)
                        .disabled(viewModel.productDraft.stockMode == .infinite)
                }

                Toggle(localizedKey(AccessL10nKey.productsEditorToggleAvailable), isOn: draftBoolBinding(\.isAvailable))

                Toggle(localizedKey(AccessL10nKey.productsEditorToggleUnlimitedStock), isOn: Binding(
                    get: { viewModel.productDraft.stockMode == .infinite },
                    set: { value in
                        viewModel.updateProductDraft {
                            $0.stockMode = value ? .infinite : .finite
                            if value {
                                $0.stockQty = ""
                            }
                        }
                    }
                ))

                if canManageEcoBasket {
                    Toggle(localizedKey(AccessL10nKey.productsEditorToggleEcobasket), isOn: draftBoolBinding(\.isEcoBasket))
                }

                if canManageCommonPurchase {
                    Toggle(localizedKey(AccessL10nKey.productsEditorToggleCommonPurchase), isOn: Binding(
                        get: { viewModel.productDraft.isCommonPurchase },
                        set: { value in
                            viewModel.updateProductDraft {
                                $0.isCommonPurchase = value
                                if value, $0.commonPurchaseType == nil {
                                    $0.commonPurchaseType = .spot
                                }
                                if !value {
                                    $0.commonPurchaseType = nil
                                }
                            }
                        }
                    ))

                    if viewModel.productDraft.isCommonPurchase {
                        Picker(
                            localizedKey(AccessL10nKey.productsEditorPickerCommonPurchaseType),
                            selection: Binding(
                                get: { viewModel.productDraft.commonPurchaseType ?? .spot },
                                set: { value in
                                    viewModel.updateProductDraft { $0.commonPurchaseType = value }
                                }
                            )
                        ) {
                            Text(localizedKey(AccessL10nKey.productsEditorPickerCommonPurchaseTypeSpot)).tag(CommonPurchaseType.spot)
                            Text(localizedKey(AccessL10nKey.productsEditorPickerCommonPurchaseTypeSeasonal)).tag(CommonPurchaseType.seasonal)
                        }
                        .pickerStyle(.segmented)
                    }
                }

                HStack(spacing: tokens.spacing.sm) {
                    ReguertaButton(
                        LocalizedStringKey(
                            viewModel.isSavingProduct
                                ? AccessL10nKey.productsEditorActionSaving
                                : AccessL10nKey.productsEditorActionSave
                        ),
                        isEnabled: !viewModel.isSavingProduct,
                        isLoading: viewModel.isSavingProduct
                    ) {
                        viewModel.saveProduct()
                    }
                    ReguertaButton(localizedKey(AccessL10nKey.productsEditorActionBack), variant: .text, fullWidth: false) {
                        viewModel.clearProductEditor()
                    }
                }
            }
        }
    }

    private func draftStringBinding(_ keyPath: WritableKeyPath<ProductDraft, String>) -> Binding<String> {
        Binding(
            get: { viewModel.productDraft[keyPath: keyPath] },
            set: { value in
                viewModel.updateProductDraft { $0[keyPath: keyPath] = value }
            }
        )
    }

    private func draftBoolBinding(_ keyPath: WritableKeyPath<ProductDraft, Bool>) -> Binding<Bool> {
        Binding(
            get: { viewModel.productDraft[keyPath: keyPath] },
            set: { value in
                viewModel.updateProductDraft { $0[keyPath: keyPath] = value }
            }
        )
    }

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }
}

private struct ProductsListRouteView: View {
    let tokens: ReguertaDesignTokens
    let viewModel: SessionViewModel
    let currentHomeMember: Member?
    let activeProducts: [Product]
    let archivedProducts: [Product]
    @Binding var pendingProducerCatalogVisibility: Bool?

    private var isProducer: Bool {
        currentHomeMember?.isProducer == true
    }

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            ReguertaCard {
                VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                    HStack(alignment: .top, spacing: tokens.spacing.md) {
                        Text(localizedKey(AccessL10nKey.productsListTitle))
                            .font(tokens.typography.titleCard)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        if isProducer {
                            Button {
                                pendingProducerCatalogVisibility = !(currentHomeMember?.producerCatalogEnabled ?? true)
                            } label: {
                                Group {
                                    if viewModel.isUpdatingProducerCatalogVisibility {
                                        ProgressView()
                                            .tint(tokens.colors.actionOnPrimary)
                                    } else {
                                        Text(
                                            currentHomeMember?.producerCatalogEnabled == true
                                            ? localizedKey(AccessL10nKey.productsListBulkToggleDisableAll)
                                            : localizedKey(AccessL10nKey.productsListBulkToggleEnableAll)
                                        )
                                            .font(tokens.typography.label)
                                            .multilineTextAlignment(.center)
                                            .lineSpacing(2)
                                    }
                                }
                                .foregroundStyle(tokens.colors.actionOnPrimary)
                                .padding(.horizontal, tokens.spacing.md)
                                .padding(.vertical, tokens.spacing.sm)
                                .background(
                                    currentHomeMember?.producerCatalogEnabled == true
                                    ? tokens.colors.feedbackWarning
                                    : tokens.colors.actionPrimary
                                )
                                .clipShape(Capsule())
                                .overlay(
                                    Capsule()
                                        .stroke(tokens.colors.surfacePrimary.opacity(0.85), lineWidth: 2)
                                )
                            }
                            .buttonStyle(.plain)
                            .disabled(viewModel.isUpdatingProducerCatalogVisibility)
                        }
                    }
                    ReguertaButton(localizedKey(AccessL10nKey.productsListActionReload), variant: .text, fullWidth: false) {
                        viewModel.refreshProducts()
                    }
                }
            }

            if viewModel.isLoadingProducts {
                ReguertaCard {
                    Text(localizedKey(AccessL10nKey.productsListLoading))
                        .font(tokens.typography.bodySecondary)
                }
            } else {
                if activeProducts.isEmpty {
                    ReguertaCard {
                        Text(localizedKey(AccessL10nKey.productsListEmpty))
                            .font(tokens.typography.bodySecondary)
                            .foregroundStyle(tokens.colors.textSecondary)
                    }
                } else {
                    ForEach(activeProducts) { product in
                        ProductCardRowView(
                            tokens: tokens,
                            product: product,
                            archived: false,
                            onEdit: { viewModel.startEditingProduct(productId: product.id) },
                            onArchive: { viewModel.archiveProduct(productId: product.id) }
                        )
                    }
                }

                if !archivedProducts.isEmpty {
                    Text(localizedKey(AccessL10nKey.productsListArchivedTitle))
                        .font(tokens.typography.label.weight(.semibold))
                        .foregroundStyle(tokens.colors.actionPrimary)
                    ForEach(archivedProducts) { product in
                        ProductCardRowView(
                            tokens: tokens,
                            product: product,
                            archived: true,
                            onEdit: { viewModel.startEditingProduct(productId: product.id) },
                            onArchive: {}
                        )
                    }
                }
            }

            ReguertaButton(localizedKey(AccessL10nKey.productsListActionAdd)) {
                viewModel.startCreatingProduct()
            }
        }
    }
}

private struct ProductCardRowView: View {
    let tokens: ReguertaDesignTokens
    let product: Product
    let archived: Bool
    let onEdit: () -> Void
    let onArchive: () -> Void

    private func decimalText(_ value: Double) -> String {
        value.truncatingRemainder(dividingBy: 1) == 0
            ? String(Int(value))
            : String(value)
    }

    var body: some View {
        ReguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                HStack(alignment: .top, spacing: tokens.spacing.md) {
                    RoundedRectangle(cornerRadius: 20.resize)
                        .fill(tokens.colors.surfaceSecondary)
                        .frame(width: 96.resize, height: 96.resize)
                        .overlay {
                            Image(systemName: "photo")
                                .font(.system(size: 28.resize))
                                .foregroundStyle(tokens.colors.textSecondary)
                        }
                    VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                                Text(product.name)
                                    .font(tokens.typography.titleCard)
                                Text(product.description.isEmpty ? l10n(AccessL10nKey.productsCardDescriptionEmpty) : product.description)
                                    .font(tokens.typography.bodySecondary)
                                    .foregroundStyle(tokens.colors.textSecondary)
                            }
                            Spacer(minLength: tokens.spacing.sm)
                            HStack(spacing: tokens.spacing.xs) {
                                Button(action: onEdit) {
                                    Image(systemName: "pencil")
                                }
                                .buttonStyle(.plain)

                                if !archived {
                                    Button(action: onArchive) {
                                        Image(systemName: "trash")
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                        Text("\(decimalText(product.price)) €")
                            .font(tokens.typography.titleCard)
                        Text(
                            archived
                            ? l10n(AccessL10nKey.productsCardStatusArchived)
                            : (
                                product.stockMode == .infinite
                                ? l10n(AccessL10nKey.productsCardStatusStockUnlimited)
                                : l10n(AccessL10nKey.productsCardStatusStockValue, decimalText(product.stockQty ?? 0))
                            )
                        )
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)
                    }
                }
            }
        }
    }
}
