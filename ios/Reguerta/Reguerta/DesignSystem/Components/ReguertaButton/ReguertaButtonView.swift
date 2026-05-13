import SwiftUI

struct ReguertaButtonView: View {
    @Environment(\.reguertaTokens) private var tokens

    let viewModel: ReguertaButtonViewModel

    var body: some View {
        switch viewModel.variant {
        case .primary:
            baseButton
                .padding(.horizontal, viewModel.fullWidth ? 0 : tokens.spacing.sm)
                .background(viewModel.backgroundColor(tokens: tokens))
                .foregroundStyle(viewModel.foregroundColor(tokens: tokens))
                .clipShape(Capsule())
        case .secondary:
            baseButton
                .padding(.horizontal, viewModel.fullWidth ? 0 : tokens.spacing.sm)
                .background(viewModel.backgroundColor(tokens: tokens))
                .overlay(
                    Capsule()
                        .stroke(tokens.colors.borderSubtle, lineWidth: 1)
                )
                .foregroundStyle(viewModel.foregroundColor(tokens: tokens))
                .clipShape(Capsule())
        case .destructive:
            baseButton
                .padding(.horizontal, viewModel.fullWidth ? 0 : tokens.spacing.sm)
                .background(viewModel.backgroundColor(tokens: tokens))
                .foregroundStyle(viewModel.foregroundColor(tokens: tokens))
                .clipShape(Capsule())
        case .text:
            baseButton.buttonStyle(.plain)
        }
    }

    private var baseButton: some View {
        Button(action: viewModel.action) {
            HStack(spacing: tokens.spacing.sm) {
                if viewModel.isLoading {
                    ProgressView()
                        .tint(viewModel.progressTint(tokens: tokens))
                }
                Text(viewModel.title)
            }
            .font(viewModel.fontStyle(tokens: tokens))
            .frame(
                maxWidth: viewModel.fullWidth ? .infinity : nil,
                minHeight: tokens.button.fullHeight
            )
            .frame(width: viewModel.fixedWidth)
            .contentShape(Rectangle())
        }
        .reguertaOptionalAccessibilityIdentifier(viewModel.accessibilityIdentifier)
        .disabled(!viewModel.isInteractive)
    }
}

#Preview("ReguertaButton") {
    VStack(spacing: 12) {
        reguertaButton("Primary") {}
        reguertaButton("Secondary", variant: .secondary) {}
        reguertaButton("Destructive", variant: .destructive) {}
        reguertaButton("Text", variant: .text, fullWidth: false) {}
        reguertaButton("Loading", isLoading: true) {}
    }
    .padding()
}

private extension View {
    @ViewBuilder
    func reguertaOptionalAccessibilityIdentifier(_ identifier: String?) -> some View {
        if let identifier {
            accessibilityIdentifier(identifier)
        } else {
            self
        }
    }
}
