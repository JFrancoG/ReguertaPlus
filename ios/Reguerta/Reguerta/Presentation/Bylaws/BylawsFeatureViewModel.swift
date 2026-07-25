import Foundation
import Observation

@MainActor
@Observable
final class BylawsFeatureViewModel {
    @ObservationIgnored let feedbackCenter: GlobalFeedbackCenter
    @ObservationIgnored let consultant: any BylawsConsulting
    @ObservationIgnored let documentProvider: any BylawsDocumentProviding
    @ObservationIgnored private var consultationTask: Task<Void, Never>?
    @ObservationIgnored private var requestSequence = 0

    var queryInput = ""
    var answerResult: BylawsConsultationResult?
    var isAsking = false
    var capability: BylawsConsultationCapability = .pdfOnly
    private(set) var consultationMessageKey: String?
    private(set) var pdfPresentation: BylawsPdfPresentation?

    var canAskQuestions: Bool {
        capability == .localModel
    }

    var canSendQuestion: Bool {
        canAskQuestions
            && !queryInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !isAsking
    }

    init(
        feedbackCenter: GlobalFeedbackCenter,
        consultant: any BylawsConsulting,
        documentProvider: any BylawsDocumentProviding,
        consultationMessageKey: String? = nil
    ) {
        self.feedbackCenter = feedbackCenter
        self.consultant = consultant
        self.documentProvider = documentProvider
        self.consultationMessageKey = consultationMessageKey
    }

    convenience init(
        feedbackCenter: GlobalFeedbackCenter = GlobalFeedbackCenter(),
        dependencies: BylawsFeatureDependencies = .preview(),
        consultationMessageKey: String? = nil
    ) {
        self.init(
            feedbackCenter: feedbackCenter,
            consultant: dependencies.consultant,
            documentProvider: dependencies.documentProvider,
            consultationMessageKey: consultationMessageKey
        )
    }

    func prepare(responseLanguage: BylawsResponseLanguage) async {
        let resolvedCapability = await consultant.capability(for: responseLanguage)
        guard !Task.isCancelled else { return }
        capability = resolvedCapability
    }

    func askQuestion(responseLanguage: BylawsResponseLanguage) {
        let question = queryInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !question.isEmpty else {
            feedbackCenter.show(AccessL10nKey.bylawsQueryRequired)
            return
        }
        guard canAskQuestions else { return }

        invalidateConsultation()
        let sequence = requestSequence
        isAsking = true
        answerResult = nil
        consultationMessageKey = nil
        consultationTask = Task { @MainActor [weak self, consultant] in
            do {
                let result = try await consultant.consult(
                    question: question,
                    responseLanguage: responseLanguage
                )
                guard let self,
                      sequence == self.requestSequence,
                      !Task.isCancelled
                else { return }
                self.answerResult = result
                self.consultationMessageKey = nil
                self.isAsking = false
                self.consultationTask = nil
            } catch let error as BylawsConsultationError {
                guard let self,
                      sequence == self.requestSequence,
                      !Task.isCancelled
                else { return }
                self.answerResult = nil
                self.isAsking = false
                self.apply(error: error)
                self.consultationTask = nil
            } catch {
                guard let self,
                      sequence == self.requestSequence,
                      !Task.isCancelled
                else { return }
                self.answerResult = nil
                self.isAsking = false
                self.consultationMessageKey = AccessL10nKey.bylawsSummaryGenerationFailed
                self.consultationTask = nil
            }
        }
    }

    func clearResult() {
        invalidateConsultation()
        queryInput = ""
        answerResult = nil
        consultationMessageKey = nil
    }

    func handleRouteExit() {
        invalidateConsultation()
        answerResult = nil
        consultationMessageKey = nil
        pdfPresentation = nil
    }

    func openPdf() {
        guard let url = documentProvider.bundledPdfURL() else {
            feedbackCenter.show(AccessL10nKey.bylawsPdfViewerUnavailable)
            return
        }
        pdfPresentation = BylawsPdfPresentation(url: url)
    }

    func dismissPdf() {
        pdfPresentation = nil
    }

    private func invalidateConsultation() {
        requestSequence &+= 1
        consultationTask?.cancel()
        consultationTask = nil
        isAsking = false
    }

    private func apply(error: BylawsConsultationError) {
        switch error {
        case .modelUnavailable:
            capability = .pdfOnly
            consultationMessageKey = nil
        case .unrelatedQuestion:
            consultationMessageKey = AccessL10nKey.bylawsQuestionUnrelated
        case .noEvidence:
            consultationMessageKey = AccessL10nKey.bylawsEvidenceInsufficient
        case .generationFailed:
            consultationMessageKey = AccessL10nKey.bylawsSummaryGenerationFailed
        }
    }
}

nonisolated struct BylawsPdfPresentation: Identifiable, Equatable, Sendable {
    let url: URL

    var id: URL { url }
}
