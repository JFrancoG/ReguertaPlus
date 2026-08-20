import SwiftUI

enum ReguertaDialogType {
    case info
    case error
}

struct ReguertaDialogAction {
    let title: String
    let action: () -> Void
}

struct ReguertaDialogConfiguration {
    let type: ReguertaDialogType
    let title: String
    let message: String
    let primaryAction: ReguertaDialogAction
    let secondaryAction: ReguertaDialogAction?
    let dismissible: Bool
    let onDismiss: (() -> Void)?

    var symbolName: String {
        switch type {
        case .info:
            "info"
        case .error:
            "exclamationmark"
        }
    }

    func accentColor(tokens: ReguertaDesignTokens) -> Color {
        switch type {
        case .info:
            tokens.colors.actionPrimary
        case .error:
            tokens.colors.feedbackError
        }
    }

    func contentColor(tokens: ReguertaDesignTokens) -> Color {
        switch type {
        case .info:
            tokens.colors.actionOnPrimary
        case .error:
            tokens.colors.feedbackOnError
        }
    }

    var primaryButtonVariant: ReguertaButtonVariant {
        switch type {
        case .info:
            .primary
        case .error:
            .destructive
        }
    }
}

@MainActor
@ViewBuilder
func reguertaDialog(
    type: ReguertaDialogType,
    title: String,
    message: String,
    primaryAction: ReguertaDialogAction,
    secondaryAction: ReguertaDialogAction? = nil,
    dismissible: Bool? = nil,
    onDismiss: (() -> Void)? = nil
) -> some View {
    ReguertaDialogView(
        configuration: ReguertaDialogConfiguration(
            type: type,
            title: title,
            message: message,
            primaryAction: primaryAction,
            secondaryAction: secondaryAction,
            dismissible: dismissible ?? (onDismiss != nil),
            onDismiss: onDismiss
        )
    )
}
