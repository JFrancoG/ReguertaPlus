import SwiftUI

struct ProductsRouteView: View {
    @Environment(\.reguertaMotionPolicy) private var motionPolicy

    let tokens: ReguertaDesignTokens
    let viewModel: ProductsRouteViewModel

    private var activeProducts: [Product] {
        viewModel.activeProducts
    }

    private var archivedProducts: [Product] {
        viewModel.archivedProducts
    }

    private func localizedKey(_ key: String) -> LocalizedStringKey { LocalizedStringKey(key) }

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollViewReader { proxy in
                ScrollView(.vertical, showsIndicators: false) {
                    routeContent
                        .padding(.bottom, tokens.spacing.sm)
                }
                .accessibilityIdentifier("products.route.scroll")
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: viewModel.highlightedProductId) { _, productId in
                    guard let productId else { return }
                    withAnimation(
                        motionPolicy.materialAnimation(.easeInOut(duration: tokens.motion.standardDuration))
                    ) {
                        proxy.scrollTo(productId, anchor: .center)
                    }
                }
            }

        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
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
            ProductEditorView(
                tokens: tokens,
                viewModel: viewModel
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

private struct ProductsListRouteView: View {
    @Environment(\.reguertaMotionPolicy) private var motionPolicy

    let tokens: ReguertaDesignTokens
    let viewModel: ProductsRouteViewModel
    let activeProducts: [Product]
    let archivedProducts: [Product]

    private func localizedKey(_ key: String) -> LocalizedStringKey { LocalizedStringKey(key) }

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
        .animation(
            motionPolicy.materialAnimation(.easeInOut(duration: tokens.motion.standardDuration)),
            value: activeProducts.map(\.id)
        )
        .animation(
            motionPolicy.materialAnimation(.easeInOut(duration: tokens.motion.standardDuration)),
            value: archivedProducts.map(\.id)
        )
    }
}

private struct ProductCardRowView: View {
    let tokens: ReguertaDesignTokens
    let product: Product
    let archived: Bool
    let isHighlighted: Bool
    let onEdit: () -> Void
    let onArchive: () -> Void

    @ScaledMetric(relativeTo: .headline) private var productThumbnailSize: CGFloat = 72

    private var descriptionText: String {
        product.description.isEmpty ? l10n(AccessL10nKey.productsCardDescriptionEmpty) : product.description
    }

    private func decimalText(_ value: Double) -> String { value.productUIDecimal }

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
                Spacer().frame(height: tokens.spacing.lg)
                ZStack(alignment: .topTrailing) {
                    HStack {
                        Spacer().frame(width: tokens.spacing.md)
                        productImage
                        Spacer()
                    }

                    HStack(spacing: tokens.spacing.sm) {
                        ReguertaListActionIconButton(
                            systemImageName: "pencil",
                            accessibilityLabel: l10n(AccessL10nKey.productsCardActionEdit),
                            backgroundColor: tokens.colors.actionPrimary,
                            foregroundColor: tokens.colors.actionOnPrimary,
                            action: onEdit
                        )

                        if !archived {
                            ReguertaListActionIconButton(
                                systemImageName: "trash",
                                accessibilityLabel: l10n(AccessL10nKey.productsCardActionArchive),
                                backgroundColor: tokens.colors.feedbackError,
                                foregroundColor: tokens.colors.feedbackOnError,
                                action: onArchive
                            )
                        }
                    }
                    .padding(.trailing, tokens.spacing.md)
                }
                Spacer().frame(height: tokens.spacing.sm)

                VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                    Text(product.name)
                        .font(tokens.typography.body.weight(.bold))
                        .foregroundStyle(tokens.colors.textPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, tokens.spacing.md)

                    Text(descriptionText)
                        .font(tokens.typography.labelRegular)
                        .foregroundStyle(tokens.colors.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, tokens.spacing.md)

                    HStack(alignment: .firstTextBaseline, spacing: tokens.spacing.sm) {
                        Text(priceText)
                            .font(tokens.typography.body.weight(.bold))
                            .foregroundStyle(tokens.colors.textPrimary)

                        Spacer(minLength: tokens.spacing.sm)

                        Text(stockText)
                            .font(tokens.typography.body.weight(.bold))
                            .foregroundStyle(tokens.colors.textPrimary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.72)
                    }
                    .padding(.horizontal, tokens.spacing.md)
                }
                Spacer().frame(height: tokens.spacing.lg)
            }
        }
    }

    @ViewBuilder
    private var productImage: some View {
        RoundedRectangle(cornerRadius: tokens.radius.sm)
            .fill(tokens.colors.surfaceSecondary)
            .frame(width: productThumbnailSize, height: productThumbnailSize)
            .overlay {
                if let imageURL = URL(string: product.productImageUrl ?? ""), !(product.productImageUrl ?? "").isEmpty {
                    AsyncImage(url: imageURL) { phase in
                        if let image = phase.image {
                            image
                                .resizable()
                                .scaledToFill()
                        } else {
                            Image("product_no_available")
                                .resizable()
                                .scaledToFill()
                        }
                    }
                    .frame(width: productThumbnailSize, height: productThumbnailSize)
                    .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))
                } else {
                    Image("product_no_available")
                        .resizable()
                        .scaledToFill()
                }
            }
            .clipped()
    }
}
