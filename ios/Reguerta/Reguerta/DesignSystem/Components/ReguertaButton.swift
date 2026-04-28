import SwiftUI

enum ReguertaButtonVariant {
    case primary
    case secondary
    case destructive
    case text
}

struct ReguertaButton: View {
    @Environment(\.reguertaTokens) private var tokens

    let title: LocalizedStringKey
    let variant: ReguertaButtonVariant
    let isEnabled: Bool
    let isLoading: Bool
    let fullWidth: Bool
    let fixedWidth: CGFloat?
    let accessibilityIdentifier: String?
    let action: () -> Void

    init(
        _ title: LocalizedStringKey,
        variant: ReguertaButtonVariant = .primary,
        isEnabled: Bool = true,
        isLoading: Bool = false,
        fullWidth: Bool = true,
        fixedWidth: CGFloat? = nil,
        accessibilityIdentifier: String? = nil,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.variant = variant
        self.isEnabled = isEnabled
        self.isLoading = isLoading
        self.fullWidth = fullWidth
        self.fixedWidth = fixedWidth
        self.accessibilityIdentifier = accessibilityIdentifier
        self.action = action
    }

    var body: some View {
        switch variant {
        case .primary:
            baseButton
                .padding(.horizontal, fullWidth ? 0 : tokens.spacing.sm)
                .background(primaryBackground)
                .foregroundStyle(primaryForeground)
                .clipShape(Capsule())
        case .secondary:
            baseButton
                .padding(.horizontal, fullWidth ? 0 : tokens.spacing.sm)
                .background(tokens.colors.surfacePrimary)
                .overlay(
                    Capsule()
                        .stroke(tokens.colors.borderSubtle, lineWidth: 1)
                )
                .foregroundStyle(tokens.colors.textPrimary)
                .clipShape(Capsule())
        case .destructive:
            baseButton
                .padding(.horizontal, fullWidth ? 0 : tokens.spacing.sm)
                .background(destructiveBackground)
                .foregroundStyle(destructiveForeground)
                .clipShape(Capsule())
        case .text:
            baseButton.buttonStyle(.plain)
        }
    }

    private var baseButton: some View {
        Button(action: action) {
            HStack(spacing: tokens.spacing.sm) {
                if isLoading {
                    ProgressView()
                        .tint(progressTint)
                }
                Text(title)
            }
            .font(fontStyle)
            .frame(
                maxWidth: fullWidth ? .infinity : nil,
                minHeight: tokens.button.fullHeight
            )
            .frame(width: fixedWidth)
            .contentShape(Rectangle())
        }
        .reguertaAccessibilityIdentifier(accessibilityIdentifier)
        .disabled(!isEnabled || isLoading)
    }

    private var primaryBackground: Color {
        (isEnabled && !isLoading)
            ? tokens.colors.actionPrimary
            : tokens.colors.surfaceSecondary
    }

    private var primaryForeground: Color {
        (isEnabled && !isLoading)
            ? tokens.colors.actionOnPrimary
            : tokens.colors.textSecondary
    }

    private var destructiveBackground: Color {
        (isEnabled && !isLoading)
            ? tokens.colors.feedbackError
            : tokens.colors.surfaceSecondary
    }

    private var destructiveForeground: Color {
        (isEnabled && !isLoading)
            ? tokens.colors.actionOnPrimary
            : tokens.colors.textSecondary
    }

    private var progressTint: Color {
        switch variant {
        case .primary:
            primaryForeground
        case .destructive:
            destructiveForeground
        case .secondary, .text:
            tokens.colors.actionPrimary
        }
    }

    private var fontStyle: Font {
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

private extension View {
    @ViewBuilder
    func reguertaAccessibilityIdentifier(_ identifier: String?) -> some View {
        if let identifier {
            accessibilityIdentifier(identifier)
        } else {
            self
        }
    }
}
