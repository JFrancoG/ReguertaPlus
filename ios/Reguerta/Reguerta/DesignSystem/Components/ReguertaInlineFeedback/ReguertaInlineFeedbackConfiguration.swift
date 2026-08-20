import SwiftUI

enum ReguertaFeedbackKind {
    case info
    case warning
    case error
}

struct ReguertaInlineFeedbackConfiguration {
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

@MainActor
@ViewBuilder
func reguertaInlineFeedback(
    _ message: LocalizedStringKey,
    kind: ReguertaFeedbackKind = .error
) -> some View {
    ReguertaInlineFeedbackView(
        configuration: ReguertaInlineFeedbackConfiguration(
            message: message,
            kind: kind
        )
    )
}
