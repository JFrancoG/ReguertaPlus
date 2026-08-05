import Foundation

struct BylawsFeatureDependencies {
    let consultant: any BylawsConsulting
    let documentProvider: any BylawsDocumentProviding

    static func live(
        knowledgeProvider: any BylawsKnowledgeProviding = BundledBylawsKnowledgeDataSource(),
        retriever: any BylawsRetrieving = SpanishBylawsArticleRetriever(),
        questionScopeClassifier: any BylawsQuestionScopeClassifying =
            SpanishBylawsQuestionScopeClassifier(),
        summaryGenerator: any BylawsSummaryGenerating = FoundationModelsBylawsSummaryGenerator(),
        documentProvider: any BylawsDocumentProviding = BundledBylawsDocumentProvider()
    ) -> BylawsFeatureDependencies {
        BylawsFeatureDependencies(
            consultant: ConsultBylawsUseCase(
                knowledgeProvider: knowledgeProvider,
                retriever: retriever,
                questionScopeClassifier: questionScopeClassifier,
                summaryGenerator: summaryGenerator
            ),
            documentProvider: documentProvider
        )
    }

    static func preview(
        capability: BylawsConsultationCapability = .localModel,
        documentProvider: any BylawsDocumentProviding = BundledBylawsDocumentProvider()
    ) -> BylawsFeatureDependencies {
        BylawsFeatureDependencies(
            consultant: PreviewBylawsConsultant(capability: capability),
            documentProvider: documentProvider
        )
    }
}

private struct PreviewBylawsConsultant: BylawsConsulting {
    let configuredCapability: BylawsConsultationCapability

    func capability(for _: BylawsResponseLanguage) async -> BylawsConsultationCapability {
        configuredCapability
    }

    func consult(question: String, responseLanguage: BylawsResponseLanguage) async throws -> BylawsConsultationResult {
        BylawsConsultationResult(
            summary: responseLanguage == .english
                ? "Local preview summary for: \(question)"
                : "Resumen local de previsualización sobre: \(question)",
            evidence: [
                BylawsSourceEvidence(
                    sourceID: "article-15",
                    articleNumber: 15,
                    title: "Artículo 15. Dimisión de la Coordinación General",
                    pageStart: 10,
                    pageEnd: 10,
                    excerpt: "La sustitución será provisional hasta la siguiente Asamblea General ordinaria."
                )
            ],
            diagnostics: BylawsConsultationDiagnostics(
                modelIdentifier: "preview/local-model",
                retrieval: [
                    BylawsRetrievalDiagnostic(sourceID: "article-15", score: 100)
                ]
            )
        )
    }
}

private extension PreviewBylawsConsultant {
    init(capability: BylawsConsultationCapability) {
        configuredCapability = capability
    }
}
