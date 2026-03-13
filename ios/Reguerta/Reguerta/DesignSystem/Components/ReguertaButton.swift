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
            baseButton.buttonStyle(.borderedProminent)
        case .secondary:
            baseButton.buttonStyle(.bordered)
        case .text:
            baseButton.buttonStyle(.plain)
        }
    }

    private var baseButton: some View {
        Button(action: action) {
            HStack(spacing: tokens.spacing.sm) {
                if isLoading {
                    ProgressView()
                        .tint(variant == .primary ? tokens.colors.actionOnPrimary : tokens.colors.actionPrimary)
                }
                Text(title)
            }
            .frame(maxWidth: fullWidth ? .infinity : nil, minHeight: 44)
            .contentShape(Rectangle())
        }
        .disabled(!isEnabled || isLoading)
    }
}
