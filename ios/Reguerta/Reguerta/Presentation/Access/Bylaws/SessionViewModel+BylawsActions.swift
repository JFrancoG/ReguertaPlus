import Foundation

private let bylawsAssistant = BylawsAssistant()

extension SessionViewModel {
    func askBylawsQuestion() {
        let question = bylawsQueryInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !question.isEmpty else {
            feedbackMessageKey = AccessL10nKey.bylawsQueryRequired
            return
        }

        isAskingBylaws = true
        Task(priority: .userInitiated) {
            let result = await bylawsAssistant.ask(question: question)
            guard !Task.isCancelled else { return }
            await MainActor.run {
                bylawsAnswerResult = result
                isAskingBylaws = false
            }
        }
    }

    func clearBylawsResult() {
        bylawsQueryInput = ""
        bylawsAnswerResult = nil
        isAskingBylaws = false
    }

    @MainActor
    func bylawsPdfURL() -> URL? {
        bylawsAssistant.bundledPdfURL()
    }
}
