import Foundation

func readMyOrderCartSnapshot(
    userDefaults: UserDefaults = .standard,
    storageKey: String
) -> MyOrderCartSnapshot {
    let quantitiesKey = "\(myOrderCartStoragePrefix).\(storageKey)\(myOrderCartQuantitiesSuffix)"
    let optionsKey = "\(myOrderCartStoragePrefix).\(storageKey)\(myOrderCartOptionsSuffix)"

    let restoredQuantities = (userDefaults.dictionary(forKey: quantitiesKey) ?? [:])
        .reduce(into: [String: Int]()) { partialResult, entry in
            let quantity = (entry.value as? Int) ?? (entry.value as? NSNumber)?.intValue ?? 0
            if quantity > 0 {
                partialResult[entry.key] = quantity
            }
        }

    let restoredOptions = (userDefaults.dictionary(forKey: optionsKey) ?? [:])
        .reduce(into: [String: String]()) { partialResult, entry in
            guard let option = entry.value as? String else { return }
            if option == ecoBasketOptionPickup || option == ecoBasketOptionNoPickup {
                partialResult[entry.key] = option
            }
        }

    return MyOrderCartSnapshot(
        selectedQuantities: restoredQuantities,
        selectedEcoBasketOptions: restoredOptions
    )
}

func persistMyOrderCartSnapshot(
    userDefaults: UserDefaults = .standard,
    storageKey: String,
    selectedQuantities: [String: Int],
    selectedEcoBasketOptions: [String: String]
) {
    let quantitiesKey = "\(myOrderCartStoragePrefix).\(storageKey)\(myOrderCartQuantitiesSuffix)"
    let optionsKey = "\(myOrderCartStoragePrefix).\(storageKey)\(myOrderCartOptionsSuffix)"

    let normalizedQuantities = selectedQuantities.filter { $0.value > 0 }
    let normalizedOptions = selectedEcoBasketOptions
        .filter { normalizedQuantities[$0.key, default: 0] > 0 }
        .filter { $0.value == ecoBasketOptionPickup || $0.value == ecoBasketOptionNoPickup }

    if normalizedQuantities.isEmpty {
        userDefaults.removeObject(forKey: quantitiesKey)
    } else {
        userDefaults.set(normalizedQuantities, forKey: quantitiesKey)
    }

    if normalizedOptions.isEmpty {
        userDefaults.removeObject(forKey: optionsKey)
    } else {
        userDefaults.set(normalizedOptions, forKey: optionsKey)
    }
}

func readMyOrderConfirmedSnapshot(
    userDefaults: UserDefaults = .standard,
    storageKey: String
) -> MyOrderCartSnapshot {
    let quantitiesKey = "\(myOrderCartStoragePrefix).\(storageKey)\(myOrderConfirmedQuantitiesSuffix)"
    let optionsKey = "\(myOrderCartStoragePrefix).\(storageKey)\(myOrderConfirmedOptionsSuffix)"

    let restoredQuantities = (userDefaults.dictionary(forKey: quantitiesKey) ?? [:])
        .reduce(into: [String: Int]()) { partialResult, entry in
            let quantity = (entry.value as? Int) ?? (entry.value as? NSNumber)?.intValue ?? 0
            if quantity > 0 {
                partialResult[entry.key] = quantity
            }
        }

    let restoredOptions = (userDefaults.dictionary(forKey: optionsKey) ?? [:])
        .reduce(into: [String: String]()) { partialResult, entry in
            guard let option = entry.value as? String else { return }
            if option == ecoBasketOptionPickup || option == ecoBasketOptionNoPickup {
                partialResult[entry.key] = option
            }
        }

    return MyOrderCartSnapshot(
        selectedQuantities: restoredQuantities,
        selectedEcoBasketOptions: restoredOptions
    )
}

func persistMyOrderConfirmedSnapshot(
    userDefaults: UserDefaults = .standard,
    storageKey: String,
    selectedQuantities: [String: Int],
    selectedEcoBasketOptions: [String: String]
) {
    let quantitiesKey = "\(myOrderCartStoragePrefix).\(storageKey)\(myOrderConfirmedQuantitiesSuffix)"
    let optionsKey = "\(myOrderCartStoragePrefix).\(storageKey)\(myOrderConfirmedOptionsSuffix)"

    let normalizedQuantities = selectedQuantities.filter { $0.value > 0 }
    let normalizedOptions = selectedEcoBasketOptions
        .filter { normalizedQuantities[$0.key, default: 0] > 0 }
        .filter { $0.value == ecoBasketOptionPickup || $0.value == ecoBasketOptionNoPickup }

    if normalizedQuantities.isEmpty {
        userDefaults.removeObject(forKey: quantitiesKey)
    } else {
        userDefaults.set(normalizedQuantities, forKey: quantitiesKey)
    }

    if normalizedOptions.isEmpty {
        userDefaults.removeObject(forKey: optionsKey)
    } else {
        userDefaults.set(normalizedOptions, forKey: optionsKey)
    }
}

extension ProductPricingMode {
    var orderWireValue: String {
        switch self {
        case .fixed:
            return "fixed"
        case .weight:
            return "weight"
        }
    }
}

extension Product {
    func matchesMyOrderSearch(_ normalizedQuery: String) -> Bool {
        guard normalizedQuery.isNotEmpty else { return true }
        return name.searchNormalized.contains(normalizedQuery) ||
            description.searchNormalized.contains(normalizedQuery) ||
            companyName.searchNormalized.contains(normalizedQuery)
    }
}

extension String {
    var searchNormalized: String {
        folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var isNotEmpty: Bool {
        !isEmpty
    }
}

extension Member {
    func committedEcoBasketProducerId(in members: [Member]) -> String? {
        guard let parity = ecoCommitmentParity else {
            return nil
        }
        return members.first { producer in
            producer.id != id &&
                producer.isProducer &&
                producer.isActive &&
                producer.producerCatalogEnabled &&
                producer.producerParity == parity
        }?.id
    }
}

extension DeliveryWeekday {
    var myOrderDayOffset: Int {
        switch self {
        case .monday: return 0
        case .tuesday: return 1
        case .wednesday: return 2
        case .thursday: return 3
        case .friday: return 4
        case .saturday: return 5
        case .sunday: return 6
        }
    }
}

extension Array {
    func chunked(into size: Int) -> [[Element]] {
        guard !isEmpty else { return [] }
        guard size > 0 else { return [self] }
        var result: [[Element]] = []
        var index = startIndex
        while index < endIndex {
            let nextIndex = self.index(index, offsetBy: size, limitedBy: endIndex) ?? endIndex
            result.append(Array(self[index..<nextIndex]))
            index = nextIndex
        }
        return result
    }
}
