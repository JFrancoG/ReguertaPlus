import SwiftUI

enum ReguertaFeedbackKind {
    case info
    case warning
    case error
}

struct ReguertaInlineFeedback: View {
    @Environment(\.reguertaTokens) private var tokens

    let message: LocalizedStringKey
    let kind: ReguertaFeedbackKind

    init(_ message: LocalizedStringKey, kind: ReguertaFeedbackKind = .error) {
        self.message = message
        self.kind = kind
    }

    var body: some View {
        HStack(spacing: tokens.spacing.sm) {
            Text("•")
                .font(tokens.typography.body)
                .foregroundStyle(color)
            Text(message)
                .font(tokens.typography.label)
                .foregroundStyle(color)
        }
    }

    private var color: Color {
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
