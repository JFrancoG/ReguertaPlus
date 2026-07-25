import Foundation
import Testing

@testable import Reguerta

struct ConsultBylawsUseCaseTests {
    @Test("No invoca el modelo cuando no esta disponible")
    func unavailableModelStopsBeforeRetrieval() async {
        let knowledge = RecordingBylawsKnowledgeProvider(index: .fixture)
        let generator = RecordingBylawsSummaryGenerator(capability: .pdfOnly)
        let useCase = ConsultBylawsUseCase(
            knowledgeProvider: knowledge,
            retriever: SpanishBylawsArticleRetriever(),
            questionScopeClassifier: SpanishBylawsQuestionScopeClassifier(),
            summaryGenerator: generator
        )

        await #expect(throws: BylawsConsultationError.modelUnavailable) {
            try await useCase.consult(
                question: "¿Qué ocurre si dimite la coordinación general?",
                responseLanguage: .spanish
            )
        }
        #expect(await knowledge.loadCount == 0)
        #expect(await generator.requests.isEmpty)
    }

    @Test("Publica solo evidencia determinista y el resumen local")
    func returnsDeterministicEvidenceWithSummary() async throws {
        let generator = RecordingBylawsSummaryGenerator(
            capability: .localModel,
            summary: "La sustitución es provisional hasta la siguiente asamblea."
        )
        let useCase = ConsultBylawsUseCase(
            knowledgeProvider: RecordingBylawsKnowledgeProvider(index: .fixture),
            retriever: SpanishBylawsArticleRetriever(),
            questionScopeClassifier: SpanishBylawsQuestionScopeClassifier(),
            summaryGenerator: generator
        )

        let result = try await useCase.consult(
            question: "¿Qué ocurre si dimite la coordinación general?",
            responseLanguage: .english
        )

        let evidence = try #require(result.evidence.first)
        #expect(result.summary == "La sustitución es provisional hasta la siguiente asamblea.")
        #expect(evidence.articleNumber == 15)
        #expect(evidence.pageStart == 10)
        #expect(evidence.pageEnd == 10)
        #expect(evidence.excerpt.isEmpty == false)
        #expect(evidence.excerpt == BylawsKnowledgeIndex.fixture.articles[0].text)
        #expect(result.diagnostics.modelIdentifier == "test/local-model")
        #expect(result.diagnostics.retrieval.isEmpty == false)
        let requests = await generator.requests
        let request = try #require(requests.first)
        #expect(request.responseLanguage == .english)
        #expect(request.evidence.first?.excerpt == BylawsKnowledgeIndex.fixture.articles[0].text)
    }

    @Test("Una consulta claramente ajena no invoca el modelo")
    func unrelatedQuestionStopsBeforeGeneration() async {
        let generator = RecordingBylawsSummaryGenerator(capability: .localModel)
        let useCase = ConsultBylawsUseCase(
            knowledgeProvider: RecordingBylawsKnowledgeProvider(index: .fixture),
            retriever: SpanishBylawsArticleRetriever(),
            questionScopeClassifier: SpanishBylawsQuestionScopeClassifier(),
            summaryGenerator: generator
        )

        await #expect(throws: BylawsConsultationError.unrelatedQuestion) {
            try await useCase.consult(
                question: "receta de bacalao al pil-pil",
                responseLanguage: .spanish
            )
        }
        #expect(await generator.requests.isEmpty)
    }

    @Test("Una consulta relacionada sin evidencia no invoca el modelo")
    func relatedQuestionWithoutEvidenceStopsBeforeGeneration() async {
        let generator = RecordingBylawsSummaryGenerator(capability: .localModel)
        let useCase = ConsultBylawsUseCase(
            knowledgeProvider: RecordingBylawsKnowledgeProvider(index: .fixture),
            retriever: SpanishBylawsArticleRetriever(),
            questionScopeClassifier: SpanishBylawsQuestionScopeClassifier(),
            summaryGenerator: generator
        )

        await #expect(throws: BylawsConsultationError.noEvidence) {
            try await useCase.consult(
                question: "¿Los estatutos regulan el uso de bicicletas en el aparcamiento?",
                responseLanguage: .spanish
            )
        }
        #expect(await generator.requests.isEmpty)
    }

    @Test("La evidencia recuperada prevalece sobre el clasificador")
    func retrievedEvidenceSkipsQuestionClassification() async throws {
        let useCase = ConsultBylawsUseCase(
            knowledgeProvider: RecordingBylawsKnowledgeProvider(index: .fixture),
            retriever: SpanishBylawsArticleRetriever(),
            questionScopeClassifier: UnexpectedBylawsQuestionScopeClassifier(),
            summaryGenerator: RecordingBylawsSummaryGenerator(capability: .localModel)
        )

        let result = try await useCase.consult(
            question: "¿Qué ocurre si dimite la coordinación general?",
            responseLanguage: .spanish
        )

        #expect(result.evidence.first?.articleNumber == 15)
    }

    @Test("Convierte un error no tipado del modelo en fallo de generacion")
    func untypedGenerationErrorIsMapped() async {
        let generator = RecordingBylawsSummaryGenerator(
            capability: .localModel,
            error: BylawsSummaryGeneratorTestError.refusal
        )
        let useCase = ConsultBylawsUseCase(
            knowledgeProvider: RecordingBylawsKnowledgeProvider(index: .fixture),
            retriever: SpanishBylawsArticleRetriever(),
            questionScopeClassifier: SpanishBylawsQuestionScopeClassifier(),
            summaryGenerator: generator
        )

        await #expect(throws: BylawsConsultationError.generationFailed) {
            try await useCase.consult(
                question: "¿Qué ocurre si dimite la coordinación general?",
                responseLanguage: .spanish
            )
        }
    }

    @Test("Conserva la indisponibilidad tipada que aparece durante la generacion")
    func generationModelUnavailableIsPreserved() async {
        let generator = RecordingBylawsSummaryGenerator(
            capability: .localModel,
            error: BylawsConsultationError.modelUnavailable
        )
        let useCase = ConsultBylawsUseCase(
            knowledgeProvider: RecordingBylawsKnowledgeProvider(index: .fixture),
            retriever: SpanishBylawsArticleRetriever(),
            questionScopeClassifier: SpanishBylawsQuestionScopeClassifier(),
            summaryGenerator: generator
        )

        await #expect(throws: BylawsConsultationError.modelUnavailable) {
            try await useCase.consult(
                question: "¿Qué ocurre si dimite la coordinación general?",
                responseLanguage: .spanish
            )
        }
    }

    @Test("El sentinel sin respaldo se presenta como evidencia insuficiente")
    func noEvidenceSentinelIsMapped() async {
        let useCase = ConsultBylawsUseCase(
            knowledgeProvider: RecordingBylawsKnowledgeProvider(index: .fixture),
            retriever: SpanishBylawsArticleRetriever(),
            questionScopeClassifier: SpanishBylawsQuestionScopeClassifier(),
            summaryGenerator: RecordingBylawsSummaryGenerator(
                capability: .localModel,
                summary: "NO_CONSTA"
            )
        )

        await #expect(throws: BylawsConsultationError.noEvidence) {
            try await useCase.consult(
                question: "¿Qué ocurre si dimite la coordinación general?",
                responseLanguage: .english
            )
        }
    }

    @Test(
        "Rechaza salidas no fundamentadas del modelo",
        arguments: [
            "NO_CONSTA",
            "No puedo responder con la información disponible.",
            "I can't answer with the available information.",
            "Según el Artículo 99, la coordinación debe dimitir.",
            "Según el artículo 15, la sustitución es provisional.",
            "Según el art. 99, la coordinación debe dimitir.",
            "Consulta la página 99 para comprobarlo.",
            "Consulta el artículo n.º 99 para comprobarlo.",
            "Los artículos 15 y 99 establecen la sustitución.",
            "Consulta las págs. 10 y 99 para comprobarlo.",
            "El artículo quince regula la sustitución.",
            "El artículo número 99 regula la sustitución.",
            "Consulta p. 99 para comprobarlo.",
            "Consulta pp. 10–11 para comprobarlo.",
            "Consulta la página noventa y nueve para comprobarlo.",
            "According to article 15, the replacement is temporary.",
            "Check page 10 for the official wording."
        ]
    )
    func rejectsUngroundedModelOutput(summary: String) async {
        let generator = RecordingBylawsSummaryGenerator(
            capability: .localModel,
            summary: summary
        )
        let useCase = ConsultBylawsUseCase(
            knowledgeProvider: RecordingBylawsKnowledgeProvider(index: .fixture),
            retriever: SpanishBylawsArticleRetriever(),
            questionScopeClassifier: SpanishBylawsQuestionScopeClassifier(),
            summaryGenerator: generator
        )

        let expectedError: BylawsConsultationError = summary == "NO_CONSTA"
            ? .noEvidence
            : .generationFailed
        await #expect(throws: expectedError) {
            try await useCase.consult(
                question: "¿Qué ocurre si dimite la coordinación general?",
                responseLanguage: .english
            )
        }
    }

    @Test("Propaga la cancelacion sin convertirla en respuesta")
    func cancellationIsPropagated() async {
        let generator = SuspendingBylawsSummaryGenerator()
        let useCase = ConsultBylawsUseCase(
            knowledgeProvider: RecordingBylawsKnowledgeProvider(index: .fixture),
            retriever: SpanishBylawsArticleRetriever(),
            questionScopeClassifier: SpanishBylawsQuestionScopeClassifier(),
            summaryGenerator: generator
        )
        let task = Task {
            try await useCase.consult(
                question: "¿Qué ocurre si dimite la coordinación general?",
                responseLanguage: .spanish
            )
        }

        await generator.waitUntilStarted()
        task.cancel()

        await #expect(throws: CancellationError.self) {
            try await task.value
        }
    }
}

private actor RecordingBylawsKnowledgeProvider: BylawsKnowledgeProviding {
    private(set) var loadCount = 0
    let index: BylawsKnowledgeIndex

    init(index: BylawsKnowledgeIndex) {
        self.index = index
    }

    func loadIndex() -> BylawsKnowledgeIndex {
        loadCount += 1
        return index
    }
}

private actor RecordingBylawsSummaryGenerator: BylawsSummaryGenerating {
    let configuredCapability: BylawsConsultationCapability
    let configuredSummary: String
    let configuredError: (any Error)?
    private(set) var requests: [BylawsSummaryRequest] = []

    nonisolated let modelIdentifier = "test/local-model"

    init(
        capability: BylawsConsultationCapability,
        summary: String = "Resumen de prueba",
        error: (any Error)? = nil
    ) {
        self.configuredCapability = capability
        self.configuredSummary = summary
        self.configuredError = error
    }

    func capability(for _: BylawsResponseLanguage) -> BylawsConsultationCapability {
        configuredCapability
    }

    func summarize(_ request: BylawsSummaryRequest) throws -> String {
        requests.append(request)
        if let configuredError {
            throw configuredError
        }
        return configuredSummary
    }
}

private actor SuspendingBylawsSummaryGenerator: BylawsSummaryGenerating {
    nonisolated let modelIdentifier = "test/suspending-model"

    private var didStart = false
    private var startWaiters: [CheckedContinuation<Void, Never>] = []

    func capability(for _: BylawsResponseLanguage) -> BylawsConsultationCapability {
        .localModel
    }

    func summarize(_: BylawsSummaryRequest) async throws -> String {
        didStart = true
        startWaiters.forEach { $0.resume() }
        startWaiters.removeAll()
        try await Task.sleep(for: .seconds(60))
        return "No debe publicarse"
    }

    func waitUntilStarted() async {
        guard !didStart else { return }
        await withCheckedContinuation { continuation in
            startWaiters.append(continuation)
        }
    }
}

private enum BylawsSummaryGeneratorTestError: Error {
    case refusal
}

private struct UnexpectedBylawsQuestionScopeClassifier: BylawsQuestionScopeClassifying {
    func classify(question _: String) -> BylawsQuestionScope {
        Issue.record("No debía invocarse el clasificador cuando ya existe evidencia")
        return .clearlyUnrelated
    }
}

private extension BylawsKnowledgeIndex {
    static let fixture = BylawsKnowledgeIndex(
        schemaVersion: 2,
        pageCount: 13,
        articles: [
            BylawsArticle(
                id: "article-15",
                kind: "article",
                articleNumber: 15,
                pageStart: 10,
                pageEnd: 10,
                title: "Artículo 15. Dimisión de la Coordinación General",
                text: "Si la Coordinación General dimitiera, ocuparía su lugar provisionalmente "
                    + "la persona socia de más edad hasta la siguiente Asamblea General ordinaria.",
                searchAliases: ["qué ocurre si dimite la coordinación general"]
            )
        ]
    )
}
