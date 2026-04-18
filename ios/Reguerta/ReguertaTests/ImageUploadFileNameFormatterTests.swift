import XCTest
@testable import Reguerta

@MainActor
final class ImageUploadFileNameFormatterTests: XCTestCase {
    func testFormatPrefixUsesUnderscoresAndTrimsTo16Characters() {
        let prefix = ImageUploadFileNameFormatter.formatPrefix(
            nameHint: "Tomate Cherry Extra Dulce",
            namespace: .products
        )

        XCTAssertEqual(prefix, "tomate_cherry_ex")
    }

    func testFormatPrefixRemovesAccentsAndSymbols() {
        let prefix = ImageUploadFileNameFormatter.formatPrefix(
            nameHint: "Título de Noticia: ¡ÚLTIMA HORA!",
            namespace: .news
        )

        XCTAssertEqual(prefix, "titulo_de_notici")
    }

    func testFormatPrefixFallsBackWhenHintIsBlank() {
        let prefix = ImageUploadFileNameFormatter.formatPrefix(
            nameHint: "   ",
            namespace: .sharedProfiles
        )

        XCTAssertEqual(prefix, "profile")
    }
}
