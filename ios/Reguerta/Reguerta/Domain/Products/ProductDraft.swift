import Foundation

struct ProductDraft: Equatable, Sendable {
    var name = ""
    var description = ""
    var productImageUrl = ""
    var price = ""
    var unitName = ""
    var unitAbbreviation = ""
    var unitPlural = ""
    var unitQty = "1"
    var packContainerName = ""
    var packContainerAbbreviation = ""
    var packContainerPlural = ""
    var packContainerQty = "1"
    var weightStep = "0.5"
    var minWeight = "0.5"
    var maxWeight = "3"
    var isAvailable = true
    var stockMode: ProductStockMode = .finite
    var stockQty = "0"
    var isEcoBasket = false
    var isCommonPurchase = false
    var commonPurchaseType: CommonPurchaseType?

    var normalized: ProductDraft {
        ProductDraft(
            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
            description: description.trimmingCharacters(in: .whitespacesAndNewlines),
            productImageUrl: productImageUrl.trimmingCharacters(in: .whitespacesAndNewlines),
            price: price.trimmingCharacters(in: .whitespacesAndNewlines),
            unitName: unitName.trimmingCharacters(in: .whitespacesAndNewlines),
            unitAbbreviation: unitAbbreviation.trimmingCharacters(in: .whitespacesAndNewlines),
            unitPlural: unitPlural.trimmingCharacters(in: .whitespacesAndNewlines),
            unitQty: unitQty.trimmingCharacters(in: .whitespacesAndNewlines),
            packContainerName: packContainerName.trimmingCharacters(in: .whitespacesAndNewlines),
            packContainerAbbreviation: packContainerAbbreviation.trimmingCharacters(in: .whitespacesAndNewlines),
            packContainerPlural: packContainerPlural.trimmingCharacters(in: .whitespacesAndNewlines),
            packContainerQty: packContainerQty.trimmingCharacters(in: .whitespacesAndNewlines),
            weightStep: weightStep.trimmingCharacters(in: .whitespacesAndNewlines),
            minWeight: minWeight.trimmingCharacters(in: .whitespacesAndNewlines),
            maxWeight: maxWeight.trimmingCharacters(in: .whitespacesAndNewlines),
            isAvailable: isAvailable,
            stockMode: stockMode,
            stockQty: stockQty.trimmingCharacters(in: .whitespacesAndNewlines),
            isEcoBasket: isEcoBasket,
            isCommonPurchase: isCommonPurchase,
            commonPurchaseType: commonPurchaseType
        )
    }
}

struct ProductSaveInput: Equatable, Sendable {
    let draft: ProductDraft
    let existing: Product?
    let price: Double
    let unitQty: Double
    let stockQty: Double?
    let packContainerQty: Double?
    let weightStep: Double?
    let minWeight: Double?
    let maxWeight: Double?
    let nowMillis: Int64
}

/// Normalizes and validates editable product fields before constructing a domain product.
///
/// Bulk products require a positive weight step and a minimum-to-maximum range aligned to that
/// step. Fixed-stock products require a non-negative stock quantity, while named non-bulk
/// containers require a positive container quantity. Numeric text fields accept either decimal
/// separator.
///
/// - Parameters:
///   - draft: The user-editable values to normalize and validate.
///   - existing: The product being edited, or `nil` when creating one.
///   - nowMillis: The creation or update time in Unix milliseconds.
/// - Returns: Parsed values ready for product construction, or `nil` when any invariant fails.
func resolveProductSaveInput(draft: ProductDraft, existing: Product?, nowMillis: Int64) -> ProductSaveInput? {
    let draft = draft.normalized
    guard let price = draft.price.productPositiveDouble, !draft.name.isEmpty else { return nil }
    let isBulk = ProductContainerOption.matching(name: draft.packContainerName) == .bulk
    let weightStep = isBulk ? draft.weightStep.productPositiveDouble : nil
    let minWeight = isBulk ? draft.minWeight.productPositiveDouble : nil
    let maxWeight = isBulk ? draft.maxWeight.productPositiveDouble : nil
    guard !isBulk || validWeightRange(minimum: minWeight, maximum: maxWeight, step: weightStep) else {
        return nil
    }
    let unitQty = isBulk ? weightStep : draft.unitQty.productPositiveDouble
    guard let unitQty,
          isBulk || (!draft.unitName.isEmpty && !draft.unitPlural.isEmpty) else {
        return nil
    }
    let stockQty = draft.stockMode == .finite ? draft.stockQty.productNonNegativeDouble : nil
    guard draft.stockMode != .finite || stockQty != nil else { return nil }
    let packContainerQty = (draft.packContainerName.isEmpty || isBulk)
        ? nil
        : draft.packContainerQty.productPositiveDouble
    guard draft.packContainerName.isEmpty || isBulk || packContainerQty != nil else { return nil }

    return ProductSaveInput(
        draft: draft,
        existing: existing,
        price: price,
        unitQty: unitQty,
        stockQty: stockQty,
        packContainerQty: packContainerQty,
        weightStep: weightStep,
        minWeight: minWeight,
        maxWeight: maxWeight,
        nowMillis: nowMillis
    )
}

/// Constructs a product from validated input while applying member-derived defaults and flags.
///
/// Existing products retain their identity, owner, company, creation time, and archive state.
/// New eco-baskets require a producer with configured parity and the eco-basket container;
/// common-purchase flags are accepted only for a non-producer common-purchase manager.
///
/// - Parameters:
///   - sessionMember: The member whose identity and capabilities supply defaults and flags.
///   - input: A value produced by `resolveProductSaveInput(draft:existing:nowMillis:)`.
///   - newProductId: The stable identifier to use only when creating a product.
/// - Returns: A product that preserves edit identity and enforces role-derived flags.
func buildProductToSave(sessionMember: Member, input: ProductSaveInput, newProductId: String = "") -> Product {
    let canManageCommonPurchase = sessionMember.isCommonPurchaseManager && !sessionMember.isProducer
    let container = ProductContainerOption.matching(name: input.draft.packContainerName)
    let isBulk = container == .bulk
    let isEcoBasket = sessionMember.isProducer && sessionMember.producerParity != nil && container == .ecoBasket
    return Product(
        id: input.existing?.id ?? newProductId,
        vendorId: input.existing?.vendorId ?? sessionMember.id,
        companyName: input.existing?.companyName ?? sessionMember.displayName,
        name: input.draft.name,
        description: input.draft.description,
        productImageUrl: input.draft.productImageUrl.isEmpty ? nil : input.draft.productImageUrl,
        price: input.price,
        pricingMode: isBulk ? .weight : .fixed,
        unitName: isBulk ? "kilo" : input.draft.unitName,
        unitAbbreviation: isBulk ? "kg" : (input.draft.unitAbbreviation.isEmpty ? nil : input.draft.unitAbbreviation),
        unitPlural: isBulk ? "kilos" : input.draft.unitPlural,
        unitQty: input.unitQty,
        packContainerName: input.draft.packContainerName.isEmpty ? nil : input.draft.packContainerName,
        packContainerAbbreviation: input.draft.packContainerAbbreviation.isEmpty ? nil : input.draft.packContainerAbbreviation,
        packContainerPlural: input.draft.packContainerPlural.isEmpty ? nil : input.draft.packContainerPlural,
        packContainerQty: input.packContainerQty,
        isAvailable: input.draft.isAvailable,
        stockMode: input.draft.stockMode,
        stockQty: input.stockQty,
        isEcoBasket: isEcoBasket,
        isCommonPurchase: canManageCommonPurchase ? input.draft.isCommonPurchase : false,
        commonPurchaseType: (canManageCommonPurchase && input.draft.isCommonPurchase) ? input.draft.commonPurchaseType : nil,
        archived: input.existing?.archived ?? false,
        createdAtMillis: input.existing?.createdAtMillis ?? input.nowMillis,
        updatedAtMillis: input.nowMillis,
        weightStep: input.weightStep,
        minWeight: input.minWeight,
        maxWeight: input.maxWeight
    )
}

extension Product {
    func toDraft() -> ProductDraft {
        ProductDraft(
            name: name,
            description: description,
            productImageUrl: productImageUrl ?? "",
            price: price.productUIDecimal,
            unitName: unitName,
            unitAbbreviation: unitAbbreviation ?? "",
            unitPlural: unitPlural,
            unitQty: unitQty.productUIDecimal,
            packContainerName: packContainerName ?? "",
            packContainerAbbreviation: packContainerAbbreviation ?? "",
            packContainerPlural: packContainerPlural ?? "",
            packContainerQty: packContainerQty?.productUIDecimal ?? "1",
            weightStep: (weightStep ?? unitQty).productUIDecimal,
            minWeight: (minWeight ?? weightStep ?? unitQty).productUIDecimal,
            maxWeight: (maxWeight ?? minWeight ?? weightStep ?? unitQty).productUIDecimal,
            isAvailable: isAvailable,
            stockMode: stockMode,
            stockQty: stockQty?.productUIDecimal ?? "",
            isEcoBasket: isEcoBasket,
            isCommonPurchase: isCommonPurchase,
            commonPurchaseType: commonPurchaseType
        )
    }

    func archivedCopy(nowMillis: Int64) -> Product {
        Product(
            id: id,
            vendorId: vendorId,
            companyName: companyName,
            name: name,
            description: description,
            productImageUrl: productImageUrl,
            price: price,
            pricingMode: pricingMode,
            unitName: unitName,
            unitAbbreviation: unitAbbreviation,
            unitPlural: unitPlural,
            unitQty: unitQty,
            packContainerName: packContainerName,
            packContainerAbbreviation: packContainerAbbreviation,
            packContainerPlural: packContainerPlural,
            packContainerQty: packContainerQty,
            isAvailable: isAvailable,
            stockMode: stockMode,
            stockQty: stockQty,
            isEcoBasket: isEcoBasket,
            isCommonPurchase: isCommonPurchase,
            commonPurchaseType: commonPurchaseType,
            archived: true,
            createdAtMillis: createdAtMillis,
            updatedAtMillis: nowMillis,
            weightStep: weightStep,
            minWeight: minWeight,
            maxWeight: maxWeight
        )
    }
}

extension Double {
    var productUIDecimal: String {
        productUIDecimal(locale: .current)
    }

    /// Formats a finite value for round-tripping through a product editor text field.
    ///
    /// Whole values omit the decimal fraction. Fractional values use the locale's decimal
    /// separator without adding grouping separators; non-finite values produce an empty string.
    ///
    /// - Parameter locale: The locale that supplies the decimal separator.
    /// - Returns: An editor-compatible decimal string.
    func productUIDecimal(locale: Locale) -> String {
        guard isFinite else { return "" }
        return truncatingRemainder(dividingBy: 1) == 0 &&
            self >= Double(Int.min) && self < Double(Int.max)
            ? String(Int(self))
            : String(self).replacingOccurrences(of: ".", with: locale.decimalSeparator ?? ".")
    }
}

private extension String {
    var productPositiveDouble: Double? {
        let normalized = replacingOccurrences(of: ",", with: ".")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty, let value = Double(normalized), value.isFinite, value > 0 else {
            return nil
        }
        return value
    }

    var productNonNegativeDouble: Double? {
        let normalized = replacingOccurrences(of: ",", with: ".")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty, let value = Double(normalized), value.isFinite, value >= 0 else {
            return nil
        }
        return value
    }
}

/// Validates that a bulk-weight range contains finite, selectable values aligned to its step.
///
/// The range must contain at least one positive selection, end on an exact step boundary within
/// floating-point tolerance, and remain representable by the persisted 32-bit selection count.
private func validWeightRange(minimum: Double?, maximum: Double?, step: Double?) -> Bool {
    guard let minimum, let maximum, let step, minimum <= maximum else { return false }
    let minimumCount = ceil(minimum / step)
    let maximumCount = floor(maximum / step)
    guard minimumCount.isFinite,
          maximumCount.isFinite,
          minimumCount >= 1,
          maximumCount >= minimumCount,
          maximumCount <= Double(Int32.max) else {
        return false
    }
    let intervals = (maximum - minimum) / step
    return intervals.isFinite && abs(intervals - intervals.rounded()) < 0.000_001
}
