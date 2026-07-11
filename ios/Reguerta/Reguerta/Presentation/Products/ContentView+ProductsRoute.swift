import SwiftUI

struct ProductsRouteView: View {
    let tokens: ReguertaDesignTokens
    let viewModel: ProductsRouteViewModel

    private var activeProducts: [Product] {
        viewModel.activeProducts
    }

    private var archivedProducts: [Product] {
        viewModel.archivedProducts
    }

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollViewReader { proxy in
                ScrollView(.vertical, showsIndicators: false) {
                    routeContent
                        .padding(.bottom, viewModel.isEditing ? tokens.spacing.sm : ReguertaFloatingActionButtonLayout.scrollContentBottomPadding)
                }
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: viewModel.highlightedProductId) { _, productId in
                    guard let productId else { return }
                    withAnimation(.easeInOut(duration: 0.25)) {
                        proxy.scrollTo(productId, anchor: .center)
                    }
                }
            }

            if !viewModel.isEditing {
                reguertaFloatingActionButton(localizedKey(AccessL10nKey.productsListActionAdd)) {
                    viewModel.startCreating()
                }
            }
        }
    }

    @ViewBuilder
    private var routeContent: some View {
        if viewModel.isEditing {
            ProductEditorCardView(
                tokens: tokens,
                viewModel: viewModel,
                canManageEcoBasket: viewModel.canManageEcoBasket,
                canManageCommonPurchase: viewModel.canManageCommonPurchase
            )
        } else {
            ProductsListRouteView(
                tokens: tokens,
                viewModel: viewModel,
                activeProducts: activeProducts,
                archivedProducts: archivedProducts
            )
        }
    }
}

private struct ProductEditorCardView: View {
    let tokens: ReguertaDesignTokens
    let viewModel: ProductsRouteViewModel
    let canManageEcoBasket: Bool
    let canManageCommonPurchase: Bool

    var body: some View {
        reguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                Text(
                    viewModel.editingProductId?.isEmpty == false
                        ? localizedKey(AccessL10nKey.productsEditorTitleEdit)
                        : localizedKey(AccessL10nKey.productsEditorTitleNew)
                )
                    .font(tokens.typography.titleCard)
                ReguertaImagePickerField(
                    tokens: tokens,
                    imageURLString: viewModel.draft.productImageUrl,
                    isUploading: viewModel.isUploadingImage,
                    placeholderSystemImage: "photo",
                    subtitleKey: AccessL10nKey.productsEditorPlaceholderNotice,
                    onPickImageData: { imageData in
                        Task { await viewModel.uploadImage(imageData) }
                    },
                    onClearImage: viewModel.clearImage,
                    onImageSelectionFailed: {
                        viewModel.showUnableSaveFeedback()
                    },
                    onCameraPermissionDenied: {
                        viewModel.showCameraPermissionRequiredFeedback()
                    },
                    onCameraUnavailable: {
                        viewModel.showCameraUnavailableFeedback()
                    }
                )

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
                        .disabled(viewModel.draft.stockMode == .infinite)
                }

                Toggle(localizedKey(AccessL10nKey.productsEditorToggleAvailable), isOn: draftBoolBinding(\.isAvailable))

                Toggle(localizedKey(AccessL10nKey.productsEditorToggleUnlimitedStock), isOn: Binding(
                    get: { viewModel.draft.stockMode == .infinite },
                    set: { value in
                        viewModel.updateDraft {
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
                        get: { viewModel.draft.isCommonPurchase },
                        set: { value in
                            viewModel.updateDraft {
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

                    if viewModel.draft.isCommonPurchase {
                        Picker(
                            localizedKey(AccessL10nKey.productsEditorPickerCommonPurchaseType),
                            selection: Binding(
                                get: { viewModel.draft.commonPurchaseType ?? .spot },
                                set: { value in
                                    viewModel.updateDraft { $0.commonPurchaseType = value }
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
                    reguertaButton(
                        LocalizedStringKey(
                            viewModel.isSaving
                                ? AccessL10nKey.productsEditorActionSaving
                                : AccessL10nKey.productsEditorActionSave
                        ),
                        isEnabled: !viewModel.isSaving && !viewModel.isUploadingImage,
                        isLoading: viewModel.isSaving
                    ) {
                        Task { await viewModel.save() }
                    }
                    reguertaButton(localizedKey(AccessL10nKey.productsEditorActionBack), variant: .text, fullWidth: false) {
                        viewModel.clearEditor()
                    }
                }
            }
        }
    }

    private func draftStringBinding(_ keyPath: WritableKeyPath<ProductDraft, String>) -> Binding<String> {
        Binding(
            get: { viewModel.draft[keyPath: keyPath] },
            set: { value in
                viewModel.updateDraft { $0[keyPath: keyPath] = value }
            }
        )
    }

    private func draftBoolBinding(_ keyPath: WritableKeyPath<ProductDraft, Bool>) -> Binding<Bool> {
        Binding(
            get: { viewModel.draft[keyPath: keyPath] },
            set: { value in
                viewModel.updateDraft { $0[keyPath: keyPath] = value }
            }
        )
    }

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }
}

private struct ProductsListRouteView: View {
    let tokens: ReguertaDesignTokens
    let viewModel: ProductsRouteViewModel
    let activeProducts: [Product]
    let archivedProducts: [Product]

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            if viewModel.isLoadingCatalog {
                reguertaCard {
                    Text(localizedKey(AccessL10nKey.productsListLoading))
                        .font(tokens.typography.bodySecondary)
                }
            } else {
                if activeProducts.isEmpty {
                    reguertaCard {
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
                            isHighlighted: viewModel.highlightedProductId == product.id,
                            onEdit: { viewModel.startEditing(productId: product.id) },
                            onArchive: { Task { await viewModel.archive(productId: product.id) } }
                        )
                        .id(product.id)
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
                            isHighlighted: viewModel.highlightedProductId == product.id,
                            onEdit: { viewModel.startEditing(productId: product.id) },
                            onArchive: {}
                        )
                        .id(product.id)
                    }
                }
            }
        }
        .animation(.easeInOut(duration: 0.25), value: activeProducts.map(\.id))
        .animation(.easeInOut(duration: 0.25), value: archivedProducts.map(\.id))
    }
}

private struct ProductCardRowView: View {
    let tokens: ReguertaDesignTokens
    let product: Product
    let archived: Bool
    let isHighlighted: Bool
    let onEdit: () -> Void
    let onArchive: () -> Void

    private var descriptionText: String {
        product.description.isEmpty ? l10n(AccessL10nKey.productsCardDescriptionEmpty) : product.description
    }

    private func decimalText(_ value: Double) -> String {
        value.productUIDecimal
    }

    private var priceText: String {
        product.price.euroCurrencyText()
    }

    private var stockText: String {
        if archived {
            return l10n(AccessL10nKey.productsCardStatusArchived)
        }
        if product.stockMode == .infinite {
            return l10n(AccessL10nKey.productsCardStatusStockUnlimited)
        }
        return l10n(AccessL10nKey.productsCardStatusStockValue, decimalText(product.stockQty ?? 0))
    }

    var body: some View {
        reguertaListItemCard(isHighlighted: isHighlighted) {
            VStack(alignment: .leading, spacing: 0) {
                Spacer().frame(height: 16.resize)
                ZStack(alignment: .topTrailing) {
                    HStack {
                        Spacer().frame(width: 12.resize)
                        productImage
                        Spacer()
                    }

                    HStack(spacing: 8.resize) {
                        ReguertaListActionIconButton(
                            systemImageName: "pencil",
                            accessibilityLabel: "Editar producto",
                            backgroundColor: tokens.colors.actionPrimary,
                            action: onEdit
                        )

                        if !archived {
                            ReguertaListActionIconButton(
                                systemImageName: "trash",
                                accessibilityLabel: "Archivar producto",
                                backgroundColor: tokens.colors.feedbackError,
                                action: onArchive
                            )
                        }
                    }
                    .padding(.trailing, 12.resize)
                }
                Spacer().frame(height: 8.resize)

                VStack(alignment: .leading, spacing: 4.resize) {
                    Text(product.name)
                        .font(.custom("CabinSketch-Bold", size: 18.resize, relativeTo: .headline))
                        .foregroundStyle(tokens.colors.textPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 12.resize)

                    Text(descriptionText)
                        .font(.custom("CabinSketch-Regular", size: 14.resize, relativeTo: .subheadline))
                        .foregroundStyle(tokens.colors.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 12.resize)

                    HStack(alignment: .firstTextBaseline, spacing: 8.resize) {
                        Text(priceText)
                            .font(.custom("CabinSketch-Bold", size: 18.resize, relativeTo: .headline))
                            .foregroundStyle(tokens.colors.textPrimary)

                        Spacer(minLength: 8.resize)

                        Text(stockText)
                            .font(.custom("CabinSketch-Bold", size: 18.resize, relativeTo: .headline))
                            .foregroundStyle(tokens.colors.textPrimary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.72)
                    }
                    .padding(.horizontal, 12.resize)
                }
                Spacer().frame(height: 16.resize)
            }
        }
    }

    @ViewBuilder
    private var productImage: some View {
        RoundedRectangle(cornerRadius: 8.resize)
            .fill(tokens.colors.surfaceSecondary)
            .frame(width: 72.resize, height: 72.resize)
            .overlay {
                if let imageURL = URL(string: product.productImageUrl ?? ""), !(product.productImageUrl ?? "").isEmpty {
                    AsyncImage(url: imageURL) { phase in
                        if let image = phase.image {
                            image
                                .resizable()
                                .scaledToFill()
                        } else {
                            Image(systemName: "photo")
                                .font(.system(size: 24.resize))
                                .foregroundStyle(tokens.colors.textSecondary)
                        }
                    }
                    .frame(width: 72.resize, height: 72.resize)
                    .clipShape(RoundedRectangle(cornerRadius: 8.resize))
                } else {
                    Image(systemName: "photo")
                        .font(.system(size: 24.resize))
                        .foregroundStyle(tokens.colors.textSecondary)
                }
            }
            .clipped()
    }
}
