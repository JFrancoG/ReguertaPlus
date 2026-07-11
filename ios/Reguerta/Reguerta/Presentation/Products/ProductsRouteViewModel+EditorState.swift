import Foundation

enum ProductStockLevel: Equatable {
    case error
    case warning
    case normal
}

func productStockLevel(quantity: Int) -> ProductStockLevel {
    switch quantity {
    case 0:
        .error
    case 1...10:
        .warning
    default:
        .normal
    }
}

@MainActor
extension ProductsRouteViewModel {
    var finiteStockQuantity: Int {
        Self.finiteStockQuantity(from: draft.stockQty)
    }

    var isUnlimitedStock: Bool {
        get { draft.stockMode == .infinite }
        set { setUnlimitedStock(newValue) }
    }

    var isCommonPurchaseEnabled: Bool {
        get { draft.isCommonPurchase }
        set {
            updateDraft {
                $0.isCommonPurchase = newValue
                if newValue, $0.commonPurchaseType == nil {
                    $0.commonPurchaseType = .spot
                } else if !newValue {
                    $0.commonPurchaseType = nil
                }
            }
        }
    }

    var commonPurchaseTypeSelection: CommonPurchaseType {
        get { draft.commonPurchaseType ?? .spot }
        set { updateDraft { $0.commonPurchaseType = newValue } }
    }

    func setUnlimitedStock(_ isUnlimited: Bool) {
        updateDraft { draft in
            draft.stockMode = isUnlimited ? .infinite : .finite
            draft.stockQty = isUnlimited ? "" : (draft.stockQty.isEmpty ? "0" : draft.stockQty)
        }
    }

    func increaseFiniteStock() {
        adjustFiniteStock(by: 10)
    }

    func decreaseFiniteStock() {
        adjustFiniteStock(by: -1)
    }

    func selectContainer(_ option: ProductContainerOption?) {
        updateDraft { draft in
            let wasBulk = ProductContainerOption.matching(name: draft.packContainerName) == .bulk
            draft.packContainerName = option?.singular ?? ""
            draft.packContainerPlural = option?.plural ?? ""
            draft.packContainerAbbreviation = option?.abbreviation ?? ""
            draft.isEcoBasket = option == .ecoBasket
            if option == .bulk {
                draft.packContainerQty = ""
                draft.unitName = "kilo"
                draft.unitPlural = "kilos"
                draft.unitAbbreviation = "kg"
                draft.unitQty = draft.weightStep.isEmpty ? "0.5" : draft.weightStep
                draft.isEcoBasket = false
            } else {
                if draft.packContainerQty.isEmpty {
                    draft.packContainerQty = "1"
                }
                if wasBulk || draft.unitQty.isEmpty {
                    draft.unitQty = "1"
                }
            }
        }
    }

    func selectMeasure(_ option: ProductMeasureOption?) {
        updateDraft { draft in
            draft.unitName = option?.singular ?? ""
            draft.unitPlural = option?.plural ?? ""
            draft.unitAbbreviation = option?.abbreviation ?? ""
            if draft.unitQty.isEmpty {
                draft.unitQty = "1"
            }
        }
    }
}

private extension ProductsRouteViewModel {
    static func finiteStockQuantity(from rawValue: String) -> Int {
        let normalized = rawValue
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: ",", with: ".")
        return max(0, Int(Double(normalized) ?? 0))
    }

    func adjustFiniteStock(by delta: Int) {
        guard draft.stockMode == .finite else { return }
        draft.stockQty = String(max(0, finiteStockQuantity + delta))
    }
}
