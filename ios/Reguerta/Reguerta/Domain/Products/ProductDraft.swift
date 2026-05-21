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
    var packContainerQty = ""
    var isAvailable = true
    var stockMode: ProductStockMode = .infinite
    var stockQty = ""
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
    let nowMillis: Int64
}

func resolveProductSaveInput(
    draft: ProductDraft,
    existing: Product?,
    nowMillis: Int64
) -> ProductSaveInput? {
    let draft = draft.normalized
    guard let price = draft.price.productPositiveDouble,
          let unitQty = draft.unitQty.productPositiveDouble,
          !draft.name.isEmpty,
          !draft.unitName.isEmpty,
          !draft.unitPlural.isEmpty else {
        return nil
    }
    let stockQty = draft.stockMode == .finite ? draft.stockQty.productNonNegativeDouble : nil
    guard draft.stockMode != .finite || stockQty != nil else {
        return nil
    }
    let packContainerQty = draft.packContainerName.isEmpty ? nil : draft.packContainerQty.productPositiveDouble
    guard draft.packContainerName.isEmpty || packContainerQty != nil else {
        return nil
    }

    return ProductSaveInput(
        draft: draft,
        existing: existing,
        price: price,
        unitQty: unitQty,
        stockQty: stockQty,
        packContainerQty: packContainerQty,
        nowMillis: nowMillis
    )
}

func buildProductToSave(sessionMember: Member, input: ProductSaveInput) -> Product {
    let canManageCommonPurchase = sessionMember.isCommonPurchaseManager && !sessionMember.isProducer
    return Product(
        id: input.existing?.id ?? "",
        vendorId: input.existing?.vendorId ?? sessionMember.id,
        companyName: input.existing?.companyName ?? sessionMember.displayName,
        name: input.draft.name,
        description: input.draft.description,
        productImageUrl: input.draft.productImageUrl.isEmpty ? nil : input.draft.productImageUrl,
        price: input.price,
        pricingMode: .fixed,
        unitName: input.draft.unitName,
        unitAbbreviation: input.draft.unitAbbreviation.isEmpty ? nil : input.draft.unitAbbreviation,
        unitPlural: input.draft.unitPlural,
        unitQty: input.unitQty,
        packContainerName: input.draft.packContainerName.isEmpty ? nil : input.draft.packContainerName,
        packContainerAbbreviation: input.draft.packContainerAbbreviation.isEmpty ? nil : input.draft.packContainerAbbreviation,
        packContainerPlural: input.draft.packContainerPlural.isEmpty ? nil : input.draft.packContainerPlural,
        packContainerQty: input.packContainerQty,
        isAvailable: input.draft.isAvailable,
        stockMode: input.draft.stockMode,
        stockQty: input.stockQty,
        isEcoBasket: sessionMember.isProducer ? input.draft.isEcoBasket : false,
        isCommonPurchase: canManageCommonPurchase ? input.draft.isCommonPurchase : false,
        commonPurchaseType: (canManageCommonPurchase && input.draft.isCommonPurchase) ? input.draft.commonPurchaseType : nil,
        archived: input.existing?.archived ?? false,
        createdAtMillis: input.existing?.createdAtMillis ?? input.nowMillis,
        updatedAtMillis: input.nowMillis
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
            packContainerQty: packContainerQty?.productUIDecimal ?? "",
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
            updatedAtMillis: nowMillis
        )
    }
}

extension Double {
    var productUIDecimal: String {
        productUIDecimal(locale: .current)
    }

    func productUIDecimal(locale: Locale) -> String {
        truncatingRemainder(dividingBy: 1) == 0
            ? String(Int(self))
            : String(self).replacingOccurrences(of: ".", with: locale.decimalSeparator ?? ".")
    }
}

private extension String {
    var productPositiveDouble: Double? {
        let normalized = replacingOccurrences(of: ",", with: ".")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty, let value = Double(normalized), value > 0 else {
            return nil
        }
        return value
    }

    var productNonNegativeDouble: Double? {
        let normalized = replacingOccurrences(of: ",", with: ".")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty, let value = Double(normalized), value >= 0 else {
            return nil
        }
        return value
    }
}
