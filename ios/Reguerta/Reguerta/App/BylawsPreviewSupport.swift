import SwiftData
import SwiftUI

struct BylawsPreviewContext {
    let modelContainer: ModelContainer
}

struct BylawsPreviewModifier: PreviewModifier {
    static func makeSharedContext() async throws -> BylawsPreviewContext {
        let configuration = ModelConfiguration(isStoredInMemoryOnly: true)
        let container = try ModelContainer(
            for: BylawsPreviewSeed.self,
            configurations: configuration
        )
        let context = container.mainContext
        if try context.fetchCount(FetchDescriptor<BylawsPreviewSeed>()) == 0 {
            let article = BylawsPreviewFixtures.longestArticle
            context.insert(
                BylawsPreviewSeed(
                    sourceID: article.id,
                    title: article.title,
                    excerpt: article.text,
                    pdfPath: BylawsPreviewFixtures.pdfURL.path
                )
            )
            try context.save()
        }
        return BylawsPreviewContext(modelContainer: container)
    }

    func body(content: Content, context: BylawsPreviewContext) -> some View {
        ReguertaTheme {
            content.modelContainer(context.modelContainer)
        }
    }
}

@MainActor
enum BylawsPreviewFixtures {
    static let longestArticle: BylawsArticle = {
        do {
            let index = try loadBundledBylawsIndex()
            guard let article = index.articles.max(by: { $0.text.count < $1.text.count }) else {
                throw BylawsPreviewError.missingBundledFixture
            }
            return article
        } catch {
            preconditionFailure("Missing bundled bylaws preview index: \(error)")
        }
    }()

    static let pdfURL: URL = {
        guard let url = BundledBylawsDocumentProvider().bundledPdfURL() else {
            preconditionFailure("Missing bundled bylaws preview PDF")
        }
        return url
    }()
}

extension BylawsFeatureViewModel {
    static func preview(
        capability: BylawsConsultationCapability,
        pdfURL: URL,
        queryInput: String = "",
        consultationMessageKey: String? = nil,
        answerResult: BylawsConsultationResult? = nil
    ) -> BylawsFeatureViewModel {
        let viewModel = BylawsFeatureViewModel(
            dependencies: .preview(
                capability: capability,
                documentProvider: PreviewBylawsDocumentProvider(pdfURL: pdfURL)
            ),
            consultationMessageKey: consultationMessageKey
        )
        viewModel.capability = capability
        viewModel.queryInput = queryInput
        viewModel.answerResult = answerResult
        return viewModel
    }
}

extension BylawsConsultationResult {
    static func preview(article: BylawsArticle) -> BylawsConsultationResult {
        BylawsConsultationResult(
            summary: "La respuesta se fundamenta exclusivamente en el extracto oficial mostrado.",
            evidence: [
                BylawsSourceEvidence(
                    sourceID: article.id,
                    articleNumber: article.articleNumber,
                    title: article.title,
                    pageStart: article.pageStart,
                    pageEnd: article.pageEnd,
                    excerpt: article.text
                )
            ],
            diagnostics: BylawsConsultationDiagnostics(
                modelIdentifier: "com.apple.foundationmodels.systemlanguage",
                retrieval: [
                    BylawsRetrievalDiagnostic(
                        sourceID: article.id,
                        score: 100
                    )
                ]
            )
        )
    }
}

private struct PreviewBylawsDocumentProvider: BylawsDocumentProviding {
    let pdfURL: URL

    @MainActor func bundledPdfURL() -> URL? { pdfURL }
}

@Model
private final class BylawsPreviewSeed {
    @Attribute(.unique) var sourceID: String
    var title: String
    var excerpt: String
    var pdfPath: String

    init(
        sourceID: String,
        title: String,
        excerpt: String,
        pdfPath: String
    ) {
        self.sourceID = sourceID
        self.title = title
        self.excerpt = excerpt
        self.pdfPath = pdfPath
    }
}

private enum BylawsPreviewError: Error {
    case missingBundledFixture
}
