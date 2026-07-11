import Foundation

enum ProductContainerOption: String, CaseIterable, Hashable, Sendable {
    case bulk
    case bottle
    case jar
    case box
    case ecoBasket
    case jug
    case can
    case net
    case bunch
    case package
    case piece

    var singular: String {
        switch self {
        case .bulk: "A granel"
        case .bottle: "Botella"
        case .jar: "Bote"
        case .box: "Caja"
        case .ecoBasket: "Ecocesta"
        case .jug: "Garrafa"
        case .can: "Lata"
        case .net: "Malla"
        case .bunch: "Manojo"
        case .package: "Paquete"
        case .piece: "Pieza"
        }
    }

    var plural: String {
        switch self {
        case .bulk: "A granel"
        case .bottle: "Botellas"
        case .jar: "Botes"
        case .box: "Cajas"
        case .ecoBasket: "Ecocestas"
        case .jug: "Garrafas"
        case .can: "Latas"
        case .net: "Mallas"
        case .bunch: "Manojos"
        case .package: "Paquetes"
        case .piece: "Piezas"
        }
    }

    var abbreviation: String { singular }

    static func matching(name: String) -> Self? {
        allCases.first { $0.singular.caseInsensitiveCompare(name.trimmingCharacters(in: .whitespacesAndNewlines)) == .orderedSame }
    }
}

enum ProductMeasureOption: String, CaseIterable, Hashable, Sendable {
    case centiliter
    case gram
    case kilogram
    case liter
    case unit

    var singular: String {
        switch self {
        case .centiliter: "centilitro"
        case .gram: "gramo"
        case .kilogram: "kilo"
        case .liter: "litro"
        case .unit: "unidad"
        }
    }

    var plural: String {
        switch self {
        case .centiliter: "centilitros"
        case .gram: "gramos"
        case .kilogram: "kilos"
        case .liter: "litros"
        case .unit: "unidades"
        }
    }

    var abbreviation: String {
        switch self {
        case .centiliter: "cL"
        case .gram: "g"
        case .kilogram: "kg"
        case .liter: "L"
        case .unit: "ud(s)."
        }
    }

    static func matching(name: String) -> Self? {
        let normalized = name
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .trimmingCharacters(in: CharacterSet(charactersIn: "."))
        return allCases.first {
            $0.singular.lowercased().trimmingCharacters(in: CharacterSet(charactersIn: ".")) == normalized
        }
    }
}
