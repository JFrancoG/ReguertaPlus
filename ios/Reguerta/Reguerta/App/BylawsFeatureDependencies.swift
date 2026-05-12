import Foundation

struct BylawsFeatureDependencies {
    let answerer: any BylawsAnswering
    let documentProvider: any BylawsDocumentProviding

    static func live(
        assistant: BylawsAssistant = BylawsAssistant()
    ) -> BylawsFeatureDependencies {
        BylawsFeatureDependencies(
            answerer: assistant,
            documentProvider: assistant
        )
    }

    static func preview(
        answerer: any BylawsAnswering = PreviewBylawsAnswerer(),
        documentProvider: any BylawsDocumentProviding = PreviewBylawsDocumentProvider()
    ) -> BylawsFeatureDependencies {
        BylawsFeatureDependencies(
            answerer: answerer,
            documentProvider: documentProvider
        )
    }
}

private struct PreviewBylawsAnswerer: BylawsAnswering {
    func ask(question: String) async -> BylawsAnswerResult {
        BylawsAnswerResult(
            mode: .local,
            answer: "Respuesta de previsualizacion sobre: \(question)",
            citedPages: [1],
            trace: BylawsDecisionTrace(
                shouldEscalate: false,
                reasons: ["preview"],
                localCoverage: 1,
                localConfidence: 1
            )
        )
    }
}

private struct PreviewBylawsDocumentProvider: BylawsDocumentProviding {
    @MainActor
    func bundledPdfURL() -> URL? {
        nil
    }
}
