import CoreText
import Foundation

enum ReguertaFontRegistrar {
    private static let fontFiles = [
        "CabinSketch-Regular.ttf",
        "CabinSketch-Bold.ttf",
    ]

    static func registerDesignFonts() {
        fontFiles.forEach(registerFontIfAvailable)
    }

    private static func registerFontIfAvailable(named fileName: String) {
        guard let fontURL = Bundle.main.url(forResource: fileName, withExtension: nil) else {
            return
        }

        CTFontManagerRegisterFontsForURL(fontURL as CFURL, .process, nil)
    }
}
