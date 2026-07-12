import Foundation
import Testing

@testable import Reguerta

struct ReguertaCurrencyFormattingTests {
    @Test
    func presentationLocaleUsesTheAppLanguageInsteadOfTheSystemRegion() {
        let locale = reguertaPresentationLocale(
            preferredLocalizations: ["en"],
            fallback: Locale(identifier: "es_ES")
        )
        let formatted = 12.5.euroCurrencyText(locale: locale)

        #expect(locale.language.languageCode == .english)
        #expect(formatted.contains("12.50"))
        #expect(formatted.trimmingCharacters(in: .whitespacesAndNewlines).hasPrefix("€"))
    }

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

    @Test
    func orderQuantityUsesUpToThreeDecimalsWithoutTrailingZeros() {
        let english = Locale(identifier: "en_US")
        let spanish = Locale(identifier: "es_ES")

        #expect(1.0.myOrderUiDecimal(locale: english) == "1")
        #expect(0.5.myOrderUiDecimal(locale: english) == "0.5")
        #expect(0.125.myOrderUiDecimal(locale: english) == "0.125")
        #expect(0.1236.myOrderUiDecimal(locale: english) == "0.124")
        #expect(0.5.myOrderUiDecimal(locale: spanish) == "0,5")
    }
}
