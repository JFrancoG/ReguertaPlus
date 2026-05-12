import Foundation
import Observation

@MainActor
@Observable
final class BylawsFeatureViewModel {
    @ObservationIgnored let feedbackCenter: GlobalFeedbackCenter
    @ObservationIgnored let answerer: any BylawsAnswering
    @ObservationIgnored let documentProvider: any BylawsDocumentProviding

    var queryInput = ""
    var answerResult: BylawsAnswerResult?
    var isAsking = false

    init(
        feedbackCenter: GlobalFeedbackCenter,
        answerer: any BylawsAnswering,
        documentProvider: any BylawsDocumentProviding
    ) {
        self.feedbackCenter = feedbackCenter
        self.answerer = answerer
        self.documentProvider = documentProvider
    }

    convenience init(
        feedbackCenter: GlobalFeedbackCenter = GlobalFeedbackCenter(),
        dependencies: BylawsFeatureDependencies = .preview()
    ) {
        self.init(
            feedbackCenter: feedbackCenter,
            answerer: dependencies.answerer,
            documentProvider: dependencies.documentProvider
        )
    }

    func askQuestion() {
        let question = queryInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !question.isEmpty else {
            feedbackCenter.show(AccessL10nKey.bylawsQueryRequired)
            return
        }

        isAsking = true
        Task { @MainActor in
            answerResult = await answerer.ask(question: question)
            isAsking = false
        }
    }

    func clearResult() {
        queryInput = ""
        answerResult = nil
        isAsking = false
    }

    func pdfURL() -> URL? {
        documentProvider.bundledPdfURL()
    }

    func reportPdfUnavailable() {
        feedbackCenter.show(AccessL10nKey.bylawsPdfViewerUnavailable)
    }
}
