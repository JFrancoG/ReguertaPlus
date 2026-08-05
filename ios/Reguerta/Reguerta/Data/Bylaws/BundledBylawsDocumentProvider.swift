import Foundation

nonisolated struct BundledBylawsDocumentProvider: BylawsDocumentProviding {
    @MainActor func bundledPdfURL() -> URL? {
        resolveBundledBylawsURL(
            fileName: "reguerta-estatutos",
            fileExtension: "pdf"
        )
    }
}
