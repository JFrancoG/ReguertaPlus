import Foundation
import Testing

@testable import Reguerta

@MainActor
struct ReguertaSessionFeatureViewModelTests {
    @Test
    func previewEnvironmentSharesFeedbackCenterAcrossRootSessionAndFeatures() {
        let environment = ReguertaAppEnvironment.preview()
        let rootViewModel = environment.accessRootViewModel

        #expect(environment.sessionViewModel.feedbackCenter === environment.feedbackCenter)
        #expect(rootViewModel.feedbackCenter === environment.feedbackCenter)
        #expect(rootViewModel.productsViewModel.feedbackCenter === environment.feedbackCenter)
        #expect(rootViewModel.shiftsViewModel.feedbackCenter === environment.feedbackCenter)
        #expect(rootViewModel.newsNotificationsViewModel.feedbackCenter === environment.feedbackCenter)
        #expect(rootViewModel.sharedProfileViewModel.feedbackCenter === environment.feedbackCenter)
        #expect(rootViewModel.usersViewModel.feedbackCenter === environment.feedbackCenter)
        #expect(rootViewModel.bylawsViewModel.feedbackCenter === environment.feedbackCenter)
    }

    @Test
    func globalFeedbackCenterStoresAndClearsMessageKey() {
        let feedbackCenter = GlobalFeedbackCenter()

        feedbackCenter.show("feedback.test")
        #expect(feedbackCenter.messageKey == "feedback.test")

        feedbackCenter.clear()
        #expect(feedbackCenter.messageKey == nil)
    }

    @Test
    func bylawsBlocksEmptyQuestionWithFeedback() {
        let feedbackCenter = GlobalFeedbackCenter()
        let viewModel = BylawsFeatureViewModel(
            feedbackCenter: feedbackCenter,
            consultant: RecordingBylawsConsultant(),
            documentProvider: FixedBylawsDocumentProvider(pdfURL: nil)
        )
        viewModel.queryInput = "   "

        viewModel.askQuestion(responseLanguage: .spanish)

        #expect(feedbackCenter.messageKey == AccessL10nKey.bylawsQueryRequired)
        #expect(viewModel.isAsking == false)
    }

    @Test
    func bylawsValidQuestionStoresAnswerAndClearsState() async {
        let consultant = RecordingBylawsConsultant()
        let viewModel = BylawsFeatureViewModel(
            feedbackCenter: GlobalFeedbackCenter(),
            consultant: consultant,
            documentProvider: FixedBylawsDocumentProvider(pdfURL: URL(string: "file:///tmp/bylaws.pdf"))
        )
        await viewModel.prepare(responseLanguage: .english)
        viewModel.queryInput = "Cuales son las cuotas?"

        viewModel.askQuestion(responseLanguage: .english)
        await waitForCondition { viewModel.answerResult != nil }

        #expect(await consultant.questions() == ["Cuales son las cuotas?"])
        #expect(await consultant.responseLanguages() == [.english])
        #expect(viewModel.answerResult?.summary == "Respuesta test")
        #expect(viewModel.isAsking == false)

        viewModel.clearResult()
        #expect(viewModel.queryInput.isEmpty)
        #expect(viewModel.answerResult == nil)
    }

    @Test
    func bylawsPdfUnavailablePublishesFeedback() {
        let feedbackCenter = GlobalFeedbackCenter()
        let viewModel = BylawsFeatureViewModel(
            feedbackCenter: feedbackCenter,
            consultant: RecordingBylawsConsultant(),
            documentProvider: FixedBylawsDocumentProvider(pdfURL: nil)
        )

        #expect(viewModel.pdfPresentation == nil)
        viewModel.openPdf()

        #expect(feedbackCenter.messageKey == AccessL10nKey.bylawsPdfViewerUnavailable)
    }

    @Test
    func previewBylawsDependenciesAnswerWithoutLiveServices() async {
        let environment = ReguertaAppEnvironment.preview()
        let viewModel = environment.accessRootViewModel.bylawsViewModel
        await viewModel.prepare(responseLanguage: .spanish)
        viewModel.queryInput = "Que dice el reglamento?"

        viewModel.askQuestion(responseLanguage: .spanish)
        await waitForCondition { viewModel.answerResult != nil }

        #expect(viewModel.answerResult?.summary.isEmpty == false)
        viewModel.openPdf()
        #expect(viewModel.pdfPresentation != nil)
    }
}

private actor RecordingBylawsConsultant: BylawsConsulting {
    private var recordedQuestions: [String] = []
    private var recordedResponseLanguages: [BylawsResponseLanguage] = []

    func capability(for _: BylawsResponseLanguage) -> BylawsConsultationCapability {
        .localModel
    }

    func consult(
        question: String,
        responseLanguage: BylawsResponseLanguage
    ) async throws -> BylawsConsultationResult {
        recordedQuestions.append(question)
        recordedResponseLanguages.append(responseLanguage)
        return BylawsConsultationResult(
            summary: "Respuesta test",
            evidence: [
                BylawsSourceEvidence(
                    sourceID: "article-6",
                    articleNumber: 6,
                    title: "Artículo 6",
                    pageStart: 6,
                    pageEnd: 6,
                    excerpt: "Abonar las cuotas."
                )
            ],
            diagnostics: BylawsConsultationDiagnostics(
                modelIdentifier: "test/local-model",
                retrieval: [
                    BylawsRetrievalDiagnostic(sourceID: "article-6", score: 100)
                ]
            )
        )
    }

    func questions() -> [String] {
        recordedQuestions
    }

    func responseLanguages() -> [BylawsResponseLanguage] {
        recordedResponseLanguages
    }
}

private struct FixedBylawsDocumentProvider: BylawsDocumentProviding {
    let pdfURL: URL?

    @MainActor
    func bundledPdfURL() -> URL? {
        pdfURL
    }
}
