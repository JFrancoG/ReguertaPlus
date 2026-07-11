import Foundation

private let reguertaEuroCurrencyCode = "EUR"

func reguertaPresentationLocale(
    preferredLocalizations: [String] = Bundle.main.preferredLocalizations,
    fallback: Locale = .current
) -> Locale {
    guard let languageIdentifier = preferredLocalizations.first,
          !languageIdentifier.isEmpty else {
        return fallback
    }
    return Locale(identifier: languageIdentifier)
}

extension Double {
    func euroCurrencyText(locale: Locale = .current) -> String {
        formatted(
            .currency(code: reguertaEuroCurrencyCode)
                .precision(.fractionLength(2))
                .locale(locale)
        )
    }
}
