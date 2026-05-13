import SwiftUI

enum ReguertaFeedbackKind {
    case info
    case warning
    case error
}

struct ReguertaInlineFeedbackViewModel {
    let message: LocalizedStringKey
    let kind: ReguertaFeedbackKind

    func color(tokens: ReguertaDesignTokens) -> Color {
        switch kind {
        case .info:
            tokens.colors.textSecondary
        case .warning:
            tokens.colors.feedbackWarning
        case .error:
            tokens.colors.feedbackError
        }
    }
}

@ViewBuilder
func reguertaInlineFeedback(
    _ message: LocalizedStringKey,
    kind: ReguertaFeedbackKind = .error
) -> some View {
    ReguertaInlineFeedbackView(
        viewModel: ReguertaInlineFeedbackViewModel(
            message: message,
            kind: kind
        )
    )
}
