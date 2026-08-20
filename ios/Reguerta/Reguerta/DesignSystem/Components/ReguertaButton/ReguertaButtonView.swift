import SwiftUI

struct ReguertaButtonView: View {
    @Environment(\.reguertaTokens) private var tokens

    let configuration: ReguertaButtonConfiguration

    var body: some View {
        switch configuration.variant {
        case .primary:
            baseButton
                .padding(.horizontal, configuration.fullWidth ? 0 : tokens.spacing.sm)
                .background(configuration.backgroundColor(tokens: tokens))
                .foregroundStyle(configuration.foregroundColor(tokens: tokens))
                .clipShape(Capsule())
        case .secondary:
            baseButton
                .padding(.horizontal, configuration.fullWidth ? 0 : tokens.spacing.sm)
                .background(configuration.backgroundColor(tokens: tokens))
                .overlay(
                    Capsule()
                        .stroke(tokens.colors.borderSubtle, lineWidth: 1)
                )
                .foregroundStyle(configuration.foregroundColor(tokens: tokens))
                .clipShape(Capsule())
        case .destructive:
            baseButton
                .padding(.horizontal, configuration.fullWidth ? 0 : tokens.spacing.sm)
                .background(configuration.backgroundColor(tokens: tokens))
                .foregroundStyle(configuration.foregroundColor(tokens: tokens))
                .clipShape(Capsule())
        case .text:
            baseButton
                .foregroundStyle(configuration.foregroundColor(tokens: tokens))
        }
    }

    private var baseButton: some View {
        Button(action: configuration.action) {
            HStack(spacing: tokens.spacing.sm) {
                if configuration.isLoading {
                    ProgressView()
                        .tint(configuration.progressTint(tokens: tokens))
                }
                Text(configuration.title)
            }
            .font(configuration.fontStyle(tokens: tokens))
            .frame(
                maxWidth: configuration.fullWidth ? .infinity : nil,
                minHeight: max(tokens.button.fullHeight, tokens.layout.minimumTouchTarget)
            )
            .frame(width: configuration.fixedWidth)
            .contentShape(Rectangle())
        }
        .reguertaOptionalAccessibilityIdentifier(configuration.accessibilityIdentifier)
        .disabled(!configuration.isInteractive)
        .buttonStyle(ReguertaContrastPreservingButtonStyle())
    }
}

private struct ReguertaContrastPreservingButtonStyle: ButtonStyle {
    @Environment(\.reguertaMotionPolicy) private var motionPolicy
    @Environment(\.reguertaTokens) private var tokens

    func makeBody(configuration: Configuration) -> some View {
        let visualState = ReguertaContrastContract.buttonVisualState(
            isPressed: configuration.isPressed,
            motionPolicy: motionPolicy
        )

        configuration.label
            .scaleEffect(visualState.scale)
            .opacity(visualState.opacity)
            .animation(
                motionPolicy.materialAnimation(.easeOut(duration: tokens.motion.quickDuration)),
                value: configuration.isPressed
            )
    }
}

#Preview(
    "Primary",
    traits: .modifier(ReguertaDesignSystemPreviewModifier(fixture: .buttonPrimary)),
    .fixedLayout(width: 320, height: 640)
) {
    ReguertaButtonView(
        configuration: ReguertaButtonConfiguration(
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

#Preview(
    "Primary AX5 · external Increased Contrast override",
    traits: .modifier(ReguertaDesignSystemPreviewModifier(fixture: .buttonAccessibility)),
    .fixedLayout(width: 320, height: 720)
) {
    reguertaButton(LocalizedStringKey(AccessL10nKey.commonAccept)) {}
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
