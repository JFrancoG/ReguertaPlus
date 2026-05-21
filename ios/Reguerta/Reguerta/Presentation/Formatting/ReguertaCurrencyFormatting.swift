import Foundation

private let reguertaEuroCurrencyCode = "EUR"

extension Double {
    func euroCurrencyText(locale: Locale = .current) -> String {
        formatted(
            .currency(code: reguertaEuroCurrencyCode)
                .precision(.fractionLength(2))
                .locale(locale)
        )
    }
}
