import SwiftUI

struct ProductEditorView: View {
    let tokens: ReguertaDesignTokens
    @Bindable var viewModel: ProductsRouteViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            ProductEditorHeroView(tokens: tokens, viewModel: viewModel)

            reguertaInputField(
                localizedKey(AccessL10nKey.productsEditorFieldName),
                text: $viewModel.draft.name,
                showsClearAction: true,
                textInputAutocapitalization: .words,
                autocorrectionDisabled: false
            )
            reguertaInputField(
                localizedKey(AccessL10nKey.productsEditorFieldDescription),
                text: $viewModel.draft.description,
                showsClearAction: true,
                textInputAutocapitalization: .sentences,
                autocorrectionDisabled: false
            )

            ProductEditorSalesFieldsView(tokens: tokens, viewModel: viewModel)
            ProductEditorOptionsView(tokens: tokens, viewModel: viewModel)

            reguertaButton(
                LocalizedStringKey(saveActionKey),
                isEnabled: !viewModel.isSaving && !viewModel.isUploadingImage,
                isLoading: viewModel.isSaving
            ) {
                Task { await viewModel.save() }
            }
        }
    }

    private var saveActionKey: String {
        if viewModel.isSaving {
            return AccessL10nKey.productsEditorActionSaving
        }
        return viewModel.editingProductId?.isEmpty == false
            ? AccessL10nKey.productsEditorActionSave
            : AccessL10nKey.productsEditorTitleNew
    }

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }
}

private struct ProductEditorHeroView: View {
    let tokens: ReguertaDesignTokens
    @Bindable var viewModel: ProductsRouteViewModel

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .top, spacing: tokens.spacing.md) {
                imagePicker
                stockControls
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            VStack(spacing: tokens.spacing.md) {
                imagePicker
                stockControls
            }
        }
    }

    private var imagePicker: some View {
        ReguertaImagePickerField(
            tokens: tokens,
            imageURLString: viewModel.draft.productImageUrl,
            isUploading: viewModel.isUploadingImage,
            placeholderSystemImage: "photo",
            placeholderAssetName: "product_no_available",
            subtitleKey: nil,
            onPickImageData: { imageData in
                Task { await viewModel.uploadImage(imageData) }
            },
            onClearImage: viewModel.clearImage,
            onImageSelectionFailed: viewModel.showUnableSaveFeedback,
            onCameraPermissionDenied: viewModel.showCameraPermissionRequiredFeedback,
            onCameraUnavailable: viewModel.showCameraUnavailableFeedback,
            previewSize: 136.resize,
            selectsImageOnPreviewTap: true,
            showsImageControls: false
        )
    }

    private var stockControls: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            Toggle(isOn: $viewModel.draft.isAvailable) {
                Text(localizedKey(AccessL10nKey.productsEditorToggleAvailable))
                    .font(tokens.typography.body)
                    .foregroundStyle(tokens.colors.textPrimary)
            }
            .padding(.bottom, 24.resize)

            if viewModel.draft.stockMode == .finite {
                HStack(spacing: tokens.spacing.sm) {
                    Text("\(localizedStockLabel): \(viewModel.finiteStockQuantity)")
                        .font(.custom("CabinSketch-Regular", size: 18.resize, relativeTo: .headline))
                        .foregroundStyle(stockQuantityColor)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    stockStepper
                }
            }

            Toggle(isOn: $viewModel.isUnlimitedStock) {
                Text(localizedKey(AccessL10nKey.productsEditorToggleUnlimitedStock))
                    .font(tokens.typography.body)
                    .foregroundStyle(tokens.colors.textPrimary)
            }
        }
    }

    private var localizedStockLabel: String {
        String(localized: String.LocalizationValue(AccessL10nKey.productsEditorFieldStock))
    }

    private var stockQuantityColor: Color {
        switch productStockLevel(quantity: viewModel.finiteStockQuantity) {
        case .error:
            tokens.colors.feedbackError
        case .warning:
            tokens.colors.feedbackWarning
        case .normal:
            tokens.colors.textPrimary
        }
    }

    private var stockStepper: some View {
        HStack(spacing: 0) {
            stockStepButton(
                systemImage: "minus",
                accessibilityKey: AccessL10nKey.productsEditorStockDecrease,
                isEnabled: viewModel.finiteStockQuantity > 0,
                action: viewModel.decreaseFiniteStock
            )
            Divider()
                .frame(height: 24.resize)
                .overlay(tokens.colors.borderSubtle)
            stockStepButton(
                systemImage: "plus",
                accessibilityKey: AccessL10nKey.productsEditorStockIncrease,
                action: viewModel.increaseFiniteStock
            )
        }
        .background(tokens.colors.surfaceSecondary, in: Capsule())
    }

    private func stockStepButton(
        systemImage: String,
        accessibilityKey: String,
        isEnabled: Bool = true,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.title3.weight(.medium))
                .foregroundStyle(
                    isEnabled
                        ? tokens.colors.textPrimary
                        : tokens.colors.textSecondary.opacity(0.35)
                )
                .frame(width: 48.resize, height: 36.resize)
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
        .opacity(isEnabled ? 1 : 0.45)
        .accessibilityLabel(Text(localizedKey(accessibilityKey)))
    }

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }
}

private struct ProductEditorSalesFieldsView: View {
    let tokens: ReguertaDesignTokens
    @Bindable var viewModel: ProductsRouteViewModel

    var body: some View {
        VStack(spacing: tokens.spacing.md) {
            if isBulk {
                ProductEditorPickerField(
                    titleKey: AccessL10nKey.productsEditorFieldPackContainerName,
                    promptKey: AccessL10nKey.productsEditorPickerSelectContainer,
                    selection: containerSelection,
                    options: availableContainers.map {
                        ProductEditorPickerOption(value: $0.singular, label: $0.singular)
                    }
                )
                ProductEditorWeightFieldsView(tokens: tokens, viewModel: viewModel)
            } else {
                ProductEditorTextFieldPair(tokens: tokens) {
                    reguertaInputField(
                        localizedKey(AccessL10nKey.productsEditorFieldPackContainerQty),
                        text: $viewModel.draft.packContainerQty,
                        keyboardType: .decimalPad
                    )
                } second: {
                    ProductEditorPickerField(
                        titleKey: AccessL10nKey.productsEditorFieldPackContainerName,
                        promptKey: AccessL10nKey.productsEditorPickerSelectContainer,
                        selection: containerSelection,
                        options: availableContainers.map {
                            ProductEditorPickerOption(value: $0.singular, label: $0.singular)
                        }
                    )
                }

                ProductEditorTextFieldPair(tokens: tokens) {
                    reguertaInputField(
                        localizedKey(AccessL10nKey.productsEditorFieldUnitQty),
                        text: $viewModel.draft.unitQty,
                        keyboardType: .decimalPad
                    )
                } second: {
                    ProductEditorPickerField(
                        titleKey: AccessL10nKey.productsEditorFieldUnitName,
                        promptKey: AccessL10nKey.productsEditorPickerSelectMeasure,
                        selection: measureSelection,
                        options: ProductMeasureOption.allCases.map {
                            ProductEditorPickerOption(value: $0.singular, label: $0.singular)
                        }
                    )
                }
            }

            reguertaInputField(
                localizedKey(AccessL10nKey.productsEditorFieldPriceEur),
                text: $viewModel.draft.price,
                showsClearAction: true,
                keyboardType: .decimalPad
            )
        }
    }

    private var isBulk: Bool {
        ProductContainerOption.matching(name: viewModel.draft.packContainerName) == .bulk
    }

    private var availableContainers: [ProductContainerOption] {
        ProductContainerOption.allCases.filter { option in
            option != .ecoBasket || viewModel.canManageEcoBasket
        }
    }

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }

    private var containerSelection: Binding<String> {
        Binding(
            get: { viewModel.draft.packContainerName },
            set: { viewModel.selectContainer(ProductContainerOption.matching(name: $0)) }
        )
    }

    private var measureSelection: Binding<String> {
        Binding(
            get: { viewModel.draft.unitName },
            set: { viewModel.selectMeasure(ProductMeasureOption.matching(name: $0)) }
        )
    }
}

private struct ProductEditorWeightFieldsView: View {
    let tokens: ReguertaDesignTokens
    @Bindable var viewModel: ProductsRouteViewModel

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .top, spacing: tokens.spacing.sm) {
                fields
            }
            VStack(spacing: tokens.spacing.md) {
                fields
            }
        }
    }

    @ViewBuilder
    private var fields: some View {
        reguertaInputField(
            LocalizedStringKey(AccessL10nKey.productsEditorFieldMinWeight),
            text: $viewModel.draft.minWeight,
            keyboardType: .decimalPad
        )
        reguertaInputField(
            LocalizedStringKey(AccessL10nKey.productsEditorFieldMaxWeight),
            text: $viewModel.draft.maxWeight,
            keyboardType: .decimalPad
        )
        reguertaInputField(
            LocalizedStringKey(AccessL10nKey.productsEditorFieldWeightStep),
            text: Binding(
                get: { viewModel.draft.weightStep },
                set: { value in
                    viewModel.updateDraft {
                        $0.weightStep = value
                        $0.unitQty = value
                    }
                }
            ),
            keyboardType: .decimalPad
        )
    }
}

private struct ProductEditorPickerOption: Hashable {
    let value: String
    let label: String
}

private struct ProductEditorPickerField: View {
    let titleKey: String
    let promptKey: String
    let selection: Binding<String>
    let options: [ProductEditorPickerOption]

    var body: some View {
        reguertaInputField(
            LocalizedStringKey(titleKey),
            text: .constant(displayedValue),
            placeholder: LocalizedStringKey(promptKey),
            isReadOnly: true,
            trailingIcon: Image(systemName: "chevron.down")
        )
        .accessibilityHidden(true)
        .overlay {
            Picker(LocalizedStringKey(titleKey), selection: selection) {
                Text(LocalizedStringKey(promptKey))
                    .tag("")
                ForEach(options, id: \.value) { option in
                    Text(option.label)
                        .tag(option.value)
                }
            }
            .pickerStyle(.menu)
            .labelsHidden()
            .opacity(0.02)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Rectangle())
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var displayedValue: String {
        options.first(where: { $0.value == selection.wrappedValue })?.label ?? ""
    }
}

private struct ProductEditorTextFieldPair<First: View, Second: View>: View {
    let tokens: ReguertaDesignTokens
    let first: First
    let second: Second

    init(
        tokens: ReguertaDesignTokens,
        @ViewBuilder first: () -> First,
        @ViewBuilder second: () -> Second
    ) {
        self.tokens = tokens
        self.first = first()
        self.second = second()
    }

    var body: some View {
        ProductEditorFieldPairLayout(
            horizontalSpacing: tokens.spacing.sm,
            verticalSpacing: tokens.spacing.md
        ) {
            first
            second
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

#Preview("Product editor quantity fields") {
    @Previewable @State var quantity = "1"
    @Previewable @State var container = ""

    ReguertaTheme {
        ProductEditorFieldPairPreview(quantity: $quantity, container: $container)
    }
}

private struct ProductEditorFieldPairPreview: View {
    @Environment(\.reguertaTokens) private var tokens
    @Binding var quantity: String
    @Binding var container: String

    var body: some View {
        ScrollView {
            VStack(spacing: tokens.spacing.lg) {
                reguertaInputField("Product name", text: .constant(""))
                reguertaInputField("Product description", text: .constant(""))
                ProductEditorTextFieldPair(tokens: tokens) {
                    reguertaInputField("Pack qty", text: $quantity)
                } second: {
                    ProductEditorPickerField(
                        titleKey: "Pack/container",
                        promptKey: "Select container",
                        selection: $container,
                        options: [ProductEditorPickerOption(value: "Box", label: "Box")]
                    )
                }
                reguertaInputField("Price in euros", text: .constant(""))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
        }
    }
}

#Preview("Product editor stock controls") {
    ReguertaTheme {
        ProductEditorStockControlsPreview()
    }
}

@MainActor
private struct ProductEditorStockControlsPreview: View {
    @Environment(\.reguertaTokens) private var tokens
    private let viewModel: ProductsRouteViewModel

    init() {
        let environment = ReguertaAppEnvironment.preview()
        let viewModel = environment.accessRootViewModel.productsViewModel
        viewModel.editingProductId = ""
        viewModel.draft = ProductDraft()
        self.viewModel = viewModel
    }

    var body: some View {
        ProductEditorHeroView(tokens: tokens, viewModel: viewModel)
            .padding(16)
    }
}

private struct ProductEditorOptionsView: View {
    let tokens: ReguertaDesignTokens
    @Bindable var viewModel: ProductsRouteViewModel

    var body: some View {
        VStack(spacing: tokens.spacing.md) {
            if viewModel.canManageCommonPurchase {
                Toggle(
                    localizedKey(AccessL10nKey.productsEditorToggleCommonPurchase),
                    isOn: $viewModel.isCommonPurchaseEnabled
                )

                if viewModel.draft.isCommonPurchase {
                    Picker(
                        localizedKey(AccessL10nKey.productsEditorPickerCommonPurchaseType),
                        selection: $viewModel.commonPurchaseTypeSelection
                    ) {
                        Text(localizedKey(AccessL10nKey.productsEditorPickerCommonPurchaseTypeSpot))
                            .tag(CommonPurchaseType.spot)
                        Text(localizedKey(AccessL10nKey.productsEditorPickerCommonPurchaseTypeSeasonal))
                            .tag(CommonPurchaseType.seasonal)
                    }
                    .pickerStyle(.segmented)
                }
            }
        }
    }

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }
}
