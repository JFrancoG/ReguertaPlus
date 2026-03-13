import SwiftUI

enum ReguertaButtonVariant {
    case primary
    case secondary
    case text
}

struct ReguertaButton: View {
    @Environment(\.reguertaTokens) private var tokens

    let title: LocalizedStringKey
    let variant: ReguertaButtonVariant
    let isEnabled: Bool
    let isLoading: Bool
    let fullWidth: Bool
    let action: () -> Void

    init(
        _ title: LocalizedStringKey,
        variant: ReguertaButtonVariant = .primary,
        isEnabled: Bool = true,
        isLoading: Bool = false,
        fullWidth: Bool = true,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.variant = variant
        self.isEnabled = isEnabled
        self.isLoading = isLoading
        self.fullWidth = fullWidth
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
        case .text:
            baseButton.buttonStyle(.plain)
        }
    }

    private var baseButton: some View {
        Button(action: action) {
            HStack(spacing: tokens.spacing.sm) {
                if isLoading {
                    ProgressView()
                        .tint(variant == .primary ? primaryForeground : tokens.colors.actionPrimary)
                }
                Text(title)
            }
            .font(tokens.typography.titleCard)
            .frame(maxWidth: fullWidth ? .infinity : nil, minHeight: 52)
            .contentShape(Rectangle())
        }
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
}
