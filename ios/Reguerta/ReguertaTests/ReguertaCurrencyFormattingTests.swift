import Foundation
import Testing

@testable import Reguerta

struct ReguertaCurrencyFormattingTests {
    @Test
    func euroCurrencyTextUsesSpanishDecimalSeparatorAndTrailingSymbol() {
        let formatted = 12.5.euroCurrencyText(locale: Locale(identifier: "es_ES"))

        #expect(formatted.contains("12,50"))
        #expect(formatted.trimmingCharacters(in: .whitespacesAndNewlines).hasSuffix("€"))
    }

    @Test
    func euroCurrencyTextUsesEnglishDecimalSeparatorAndLeadingSymbol() {
        let formatted = 12.5.euroCurrencyText(locale: Locale(identifier: "en_US"))

        #expect(formatted.contains("12.50"))
        #expect(formatted.trimmingCharacters(in: .whitespacesAndNewlines).hasPrefix("€"))
    }

    @Test
    func productUIDecimalUsesLocaleDecimalSeparator() {
        #expect(12.5.productUIDecimal(locale: Locale(identifier: "es_ES")) == "12,5")
        #expect(12.5.productUIDecimal(locale: Locale(identifier: "en_US")) == "12.5")
    }
}
