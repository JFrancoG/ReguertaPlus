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
            baseButton
                .foregroundStyle(viewModel.foregroundColor(tokens: tokens))
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
        .buttonStyle(ReguertaContrastPreservingButtonStyle())
    }
}

private struct ReguertaContrastPreservingButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        let visualState = ReguertaContrastContract.buttonVisualState(isPressed: configuration.isPressed)

        configuration.label
            .scaleEffect(visualState.scale)
            .opacity(visualState.opacity)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

#Preview("Primary", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    ReguertaButtonView(
        viewModel: ReguertaButtonViewModel(
            title: LocalizedStringKey(AccessL10nKey.commonAccept),
            variant: .primary,
            isEnabled: true,
            isLoading: false,
            fullWidth: true,
            fixedWidth: nil,
            accessibilityIdentifier: nil,
            action: {}
        )
    )
    .padding()
}

private extension View {
    @ViewBuilder func reguertaOptionalAccessibilityIdentifier(_ identifier: String?) -> some View {
        if let identifier {
            accessibilityIdentifier(identifier)
        } else {
            self
        }
    }
}
