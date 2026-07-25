import Foundation
import Testing

@testable import Reguerta

@MainActor
struct BylawsFeatureViewModelConcurrencyTests {
    @Test("La ultima consulta reemplaza a una respuesta tardia")
    func latestQuestionWins() async throws {
        let consultant = ControlledBylawsConsultant()
        let viewModel = makeViewModel(consultant: consultant)
        await viewModel.prepare(responseLanguage: .spanish)

        viewModel.queryInput = "Primera pregunta"
        viewModel.askQuestion(responseLanguage: .spanish)
        await consultant.waitForRequestCount(1)

        viewModel.queryInput = "Segunda pregunta"
        viewModel.askQuestion(responseLanguage: .spanish)
        await consultant.waitForRequestCount(2)

        await consultant.completeRequest(at: 1, with: .success(.fixture(summary: "Segunda")))
        await waitUntil { viewModel.answerResult?.summary == "Segunda" }
        await consultant.completeRequest(at: 0, with: .success(.fixture(summary: "Primera")))
        await Task.yield()

        #expect(viewModel.answerResult?.summary == "Segunda")
        #expect(viewModel.capability == .localModel)
    }

    @Test("Limpiar cancela e invalida una respuesta tardia")
    func clearInvalidatesInFlightAnswer() async {
        let consultant = ControlledBylawsConsultant()
        let viewModel = makeViewModel(consultant: consultant)
        await viewModel.prepare(responseLanguage: .spanish)
        viewModel.queryInput = "Pregunta pendiente"
        viewModel.askQuestion(responseLanguage: .spanish)
        await consultant.waitForRequestCount(1)

        viewModel.clearResult()
        await consultant.completeRequest(at: 0, with: .success(.fixture(summary: "Tardía")))
        await Task.yield()

        #expect(viewModel.answerResult == nil)
        #expect(viewModel.queryInput.isEmpty)
        #expect(viewModel.isAsking == false)
        #expect(viewModel.capability == .localModel)
        #expect(viewModel.consultationMessageKey == nil)
    }

    @Test("Salir de la ruta cancela e invalida una respuesta tardia")
    func routeExitInvalidatesInFlightAnswer() async {
        let consultant = ControlledBylawsConsultant()
        let viewModel = makeViewModel(consultant: consultant)
        await viewModel.prepare(responseLanguage: .spanish)
        viewModel.queryInput = "Pregunta pendiente"
        viewModel.askQuestion(responseLanguage: .spanish)
        await consultant.waitForRequestCount(1)

        viewModel.handleRouteExit()
        await consultant.completeRequest(at: 0, with: .success(.fixture(summary: "Tardía")))
        await Task.yield()

        #expect(viewModel.answerResult == nil)
        #expect(viewModel.isAsking == false)
        #expect(viewModel.consultationMessageKey == nil)
    }

    @Test(
        "Los fallos de contenido muestran un aviso sin ocultar la consulta",
        arguments: [
            BylawsFailurePresentationExpectation(
                error: .unrelatedQuestion,
                messageKey: "bylaws.question.unrelated"
            ),
            BylawsFailurePresentationExpectation(
                error: .noEvidence,
                messageKey: "bylaws.evidence.insufficient"
            ),
            BylawsFailurePresentationExpectation(
                error: .generationFailed,
                messageKey: "bylaws.summary.generation_failed"
            )
        ]
    )
    func contentFailureKeepsLocalConsultation(
        expectation: BylawsFailurePresentationExpectation
    ) async {
        let consultant = ControlledBylawsConsultant()
        let viewModel = makeViewModel(consultant: consultant)
        await viewModel.prepare(responseLanguage: .spanish)
        viewModel.queryInput = "Pregunta"
        viewModel.askQuestion(responseLanguage: .spanish)
        await consultant.waitForRequestCount(1)

        await consultant.completeRequest(
            at: 0,
            with: .failure(expectation.error)
        )
        await waitUntil { viewModel.consultationMessageKey == expectation.messageKey }

        #expect(viewModel.answerResult == nil)
        #expect(viewModel.isAsking == false)
        #expect(viewModel.capability == .localModel)
        #expect(viewModel.canAskQuestions)
    }

    @Test("Solo la indisponibilidad real pasa la pantalla a modo solo PDF")
    func modelUnavailableFallsBackToPdfOnly() async {
        let consultant = ControlledBylawsConsultant()
        let viewModel = makeViewModel(consultant: consultant)
        await viewModel.prepare(responseLanguage: .spanish)
        viewModel.queryInput = "Pregunta"
        viewModel.askQuestion(responseLanguage: .spanish)
        await consultant.waitForRequestCount(1)

        await consultant.completeRequest(
            at: 0,
            with: .failure(BylawsConsultationError.modelUnavailable)
        )
        await waitUntil { viewModel.capability == .pdfOnly }

        #expect(viewModel.answerResult == nil)
        #expect(viewModel.isAsking == false)
        #expect(viewModel.consultationMessageKey == nil)
    }

    @Test("El aviso se limpia al reintentar, acertar, borrar y salir")
    func noticeLifecycleMatchesConsultationLifecycle() async {
        let consultant = ControlledBylawsConsultant()
        let viewModel = makeViewModel(consultant: consultant)
        await viewModel.prepare(responseLanguage: .english)

        viewModel.queryInput = "Primera pregunta"
        viewModel.askQuestion(responseLanguage: .english)
        await consultant.waitForRequestCount(1)
        await consultant.completeRequest(at: 0, with: .failure(BylawsConsultationError.noEvidence))
        await waitUntil { viewModel.consultationMessageKey != nil }

        viewModel.queryInput = "Segunda pregunta"
        viewModel.askQuestion(responseLanguage: .english)
        #expect(viewModel.consultationMessageKey == nil)
        await consultant.waitForRequestCount(2)
        await consultant.completeRequest(at: 1, with: .success(.fixture(summary: "Answer")))
        await waitUntil { viewModel.answerResult?.summary == "Answer" }
        #expect(viewModel.consultationMessageKey == nil)

        viewModel.clearResult()
        #expect(viewModel.consultationMessageKey == nil)
        viewModel.handleRouteExit()
        #expect(viewModel.consultationMessageKey == nil)

        let languages = await consultant.consultationLanguages
        #expect(languages == [.english, .english])
    }

    @Test("La indisponibilidad inicial oculta la consulta y conserva el PDF")
    func unavailableCapabilityIsPdfOnly() async {
        let consultant = ControlledBylawsConsultant(capability: .pdfOnly)
        let viewModel = makeViewModel(consultant: consultant)

        await viewModel.prepare(responseLanguage: .english)

        #expect(viewModel.capability == .pdfOnly)
        #expect(viewModel.canAskQuestions == false)
        viewModel.openPdf()
        #expect(viewModel.pdfPresentation != nil)
        #expect(await consultant.capabilityLanguages == [.english])
    }
}

@MainActor
private func makeViewModel(
    consultant: some BylawsConsulting
) -> BylawsFeatureViewModel {
    BylawsFeatureViewModel(
        feedbackCenter: GlobalFeedbackCenter(),
        consultant: consultant,
        documentProvider: FixedConcurrencyTestBylawsDocumentProvider(
            pdfURL: URL(string: "file:///tmp/bylaws.pdf")
        )
    )
}

@MainActor
private func waitUntil(
    _ condition: @escaping @MainActor () -> Bool
) async {
    for _ in 0 ..< 1_000 {
        guard !condition() else { return }
        await Task.yield()
    }
    Issue.record("La condición no se cumplió")
}

private actor ControlledBylawsConsultant: BylawsConsulting {
    let configuredCapability: BylawsConsultationCapability
    private var requests: [String] = []
    private var continuations: [CheckedContinuation<BylawsConsultationResult, any Error>] = []
    private(set) var capabilityLanguages: [BylawsResponseLanguage] = []
    private(set) var consultationLanguages: [BylawsResponseLanguage] = []

    init(capability: BylawsConsultationCapability = .localModel) {
        self.configuredCapability = capability
    }

    func capability(
        for responseLanguage: BylawsResponseLanguage
    ) -> BylawsConsultationCapability {
        capabilityLanguages.append(responseLanguage)
        return configuredCapability
    }

    func consult(
        question: String,
        responseLanguage: BylawsResponseLanguage
    ) async throws -> BylawsConsultationResult {
        requests.append(question)
        consultationLanguages.append(responseLanguage)
        return try await withCheckedThrowingContinuation { continuation in
            continuations.append(continuation)
        }
    }

    func waitForRequestCount(_ expectedCount: Int) async {
        while requests.count < expectedCount {
            await Task.yield()
        }
    }

    func completeRequest(
        at index: Int,
        with result: Result<BylawsConsultationResult, any Error>
    ) {
        continuations[index].resume(with: result)
    }
}

struct BylawsFailurePresentationExpectation: Sendable, CustomTestStringConvertible {
    let error: BylawsConsultationError
    let messageKey: String

    var testDescription: String { "\(error) -> \(messageKey)" }
}

private struct FixedConcurrencyTestBylawsDocumentProvider: BylawsDocumentProviding {
    let pdfURL: URL?

    @MainActor
    func bundledPdfURL() -> URL? {
        pdfURL
    }
}

private extension BylawsConsultationResult {
    static func fixture(summary: String) -> BylawsConsultationResult {
        BylawsConsultationResult(
            summary: summary,
            evidence: [
                BylawsSourceEvidence(
                    sourceID: "article-15",
                    articleNumber: 15,
                    title: "Artículo 15",
                    pageStart: 10,
                    pageEnd: 10,
                    excerpt: "Extracto oficial"
                )
            ],
            diagnostics: BylawsConsultationDiagnostics(
                modelIdentifier: "test/local-model",
                retrieval: [
                    BylawsRetrievalDiagnostic(sourceID: "article-15", score: 100)
                ]
            )
        )
    }
}
