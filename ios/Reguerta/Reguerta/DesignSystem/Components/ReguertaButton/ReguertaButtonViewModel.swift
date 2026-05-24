import SwiftUI

enum ReguertaButtonVariant {
    case primary
    case secondary
    case destructive
    case text
}

struct ReguertaButtonViewModel {
    let title: LocalizedStringKey
    let variant: ReguertaButtonVariant
    let isEnabled: Bool
    let isLoading: Bool
    let fullWidth: Bool
    let fixedWidth: CGFloat?
    let accessibilityIdentifier: String?
    let action: () -> Void

    var isInteractive: Bool {
        isEnabled && !isLoading
    }

    func backgroundColor(tokens: ReguertaDesignTokens) -> Color {
        switch variant {
        case .primary:
            isInteractive ? tokens.colors.actionPrimary : tokens.colors.surfaceSecondary
        case .secondary:
            isInteractive ? tokens.colors.surfacePrimary : tokens.colors.surfaceSecondary
        case .destructive:
            isInteractive ? tokens.colors.feedbackError : tokens.colors.surfaceSecondary
        case .text:
            .clear
        }
    }

    func foregroundColor(tokens: ReguertaDesignTokens) -> Color {
        if !isInteractive {
            return tokens.colors.textPrimary.opacity(0.86)
        }

        return switch variant {
        case .primary, .destructive:
            tokens.colors.actionOnPrimary
        case .secondary:
            tokens.colors.textPrimary
        case .text:
            tokens.colors.actionPrimary
        }
    }

    func progressTint(tokens: ReguertaDesignTokens) -> Color {
        switch variant {
        case .primary, .destructive:
            foregroundColor(tokens: tokens)
        case .secondary, .text:
            tokens.colors.actionPrimary
        }
    }

    func fontStyle(tokens: ReguertaDesignTokens) -> Font {
        switch variant {
        case .primary, .destructive:
            tokens.button.primaryFont
        case .secondary:
            tokens.button.secondaryFont
        case .text:
            tokens.button.textFont
        }
    }
}

@ViewBuilder
func reguertaButton(
    _ title: LocalizedStringKey,
    variant: ReguertaButtonVariant = .primary,
    isEnabled: Bool = true,
    isLoading: Bool = false,
    fullWidth: Bool = true,
    fixedWidth: CGFloat? = nil,
    accessibilityIdentifier: String? = nil,
    action: @escaping () -> Void
) -> some View {
    ReguertaButtonView(
        viewModel: ReguertaButtonViewModel(
            title: title,
            variant: variant,
            isEnabled: isEnabled,
            isLoading: isLoading,
            fullWidth: fullWidth,
            fixedWidth: fixedWidth,
            accessibilityIdentifier: accessibilityIdentifier,
            action: action
        )
    )
}
