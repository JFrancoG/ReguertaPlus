import Foundation

enum ImageUploadFileNameFormatter {
    static func formatPrefix(
        nameHint: String?,
        namespace: ImageUploadNamespace,
        maxLength: Int = defaultPrefixMaxLength
    ) -> String {
        let fallback: String = switch namespace {
        case .products: "product"
        case .news: "news"
        case .sharedProfiles: "profile"
        }

        let normalized = normalizeHint(nameHint)
        let clampedLength = max(1, maxLength)
        let limited = String(normalized.prefix(clampedLength))
        return limited.isEmpty ? fallback : limited
    }

    private static func normalizeHint(_ hint: String?) -> String {
        let source = (hint ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !source.isEmpty else { return "" }

        let deAccented = source.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
        let wordsWithUnderscores = deAccented
            .replacingOccurrences(of: "\\s+", with: "_", options: .regularExpression)
        let alphanumericUnderscoreOnly = wordsWithUnderscores
            .replacingOccurrences(of: "[^A-Za-z0-9_]", with: "", options: .regularExpression)
            .replacingOccurrences(of: "_+", with: "_", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "_"))

        return alphanumericUnderscoreOnly.lowercased()
    }

    private static let defaultPrefixMaxLength = 16
}
