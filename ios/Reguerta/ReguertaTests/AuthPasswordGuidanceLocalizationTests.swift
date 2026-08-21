import Foundation
import Testing

@Suite("Auth password guidance localization")
struct AuthPasswordGuidanceLocalizationTests {
    @Test(
        "La ayuda de contraseña expresa el rango inclusivo 6...16",
        arguments: [
            ("en", "English"),
            ("es", "Spanish")
        ]
    )
    func weakPasswordGuidanceIncludesBothLengthBoundaries(locale: String, language: String) throws {
        let data = try Data(contentsOf: localizableCatalogURL())
        let catalog = try JSONDecoder().decode(AuthStringCatalog.self, from: data)
        let entry = try #require(catalog.strings["auth_error.weak_password"])
        let localization = try #require(entry.localizations?[locale])
        let guidance = localization.stringUnit.value
        let numericTokens = guidance
            .split(whereSeparator: { !$0.isNumber })
            .compactMap { Int($0) }
        let minimumIndex = try #require(numericTokens.firstIndex(of: 6))
        let maximumIndex = try #require(numericTokens.firstIndex(of: 16))

        #expect(
            minimumIndex < maximumIndex,
            "\(language) debe comunicar los limites inclusivos 6 y 16: \(guidance)"
        )
    }
}

private struct AuthStringCatalog: Decodable {
    let strings: [String: AuthStringCatalogEntry]
}

private struct AuthStringCatalogEntry: Decodable {
    let localizations: [String: AuthStringCatalogLocalization]?
}

private struct AuthStringCatalogLocalization: Decodable {
    let stringUnit: AuthStringCatalogUnit
}

private struct AuthStringCatalogUnit: Decodable {
    let value: String
}

private func localizableCatalogURL() -> URL {
    URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .appending(path: "Reguerta/Resources/Localizable.xcstrings")
}
