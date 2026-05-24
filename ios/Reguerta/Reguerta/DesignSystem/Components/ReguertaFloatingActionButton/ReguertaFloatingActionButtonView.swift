import SwiftUI

@MainActor
enum ReguertaFloatingActionButtonLayout {
    static var scrollContentBottomPadding: CGFloat {
        88.resize + 8.resizeBottomSize
    }
}

struct ReguertaFloatingActionButtonView: View {
    @Environment(\.reguertaTokens) private var tokens

    let title: Text
    let isEnabled: Bool
    let accessibilityIdentifier: String?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            title
                .font(tokens.typography.body.weight(.semibold))
                .foregroundStyle(isEnabled ? tokens.colors.actionOnPrimary : tokens.colors.textPrimary.opacity(0.86))
                .lineLimit(1)
                .minimumScaleFactor(0.78)
                .frame(maxWidth: .infinity)
                .frame(height: 52.resize)
                .background {
                    ReguertaFloatingActionButtonBackground(isEnabled: isEnabled)
                }
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
        .padding(.horizontal, tokens.spacing.xl + tokens.spacing.sm)
        .padding(.bottom, 8.resizeBottomSize)
        .shadow(color: .black.opacity(0.18), radius: 14.resize, y: 6.resize)
        .reguertaOptionalAccessibilityIdentifier(accessibilityIdentifier)
    }
}

private struct ReguertaFloatingActionButtonBackground: View {
    @Environment(\.reguertaTokens) private var tokens

    let isEnabled: Bool

    var body: some View {
        let shape = Capsule()
        let actionOpacity = isEnabled ? 0.42 : 0.22

        if #available(iOS 26.0, *) {
            shape
                .fill(isEnabled ? tokens.colors.actionPrimary.opacity(actionOpacity) : tokens.colors.surfaceSecondary)
                .glassEffect(
                    .regular
                        .tint(isEnabled ? tokens.colors.actionPrimary.opacity(0.32) : tokens.colors.surfaceSecondary.opacity(0.72))
                        .interactive(isEnabled),
                    in: shape
                )
        } else {
            shape
                .fill(.ultraThinMaterial)
                .background(isEnabled ? tokens.colors.actionPrimary.opacity(0.72) : tokens.colors.surfaceSecondary, in: shape)
        }
    }
}

@ViewBuilder
func reguertaFloatingActionButton(
    _ title: LocalizedStringKey,
    isEnabled: Bool = true,
    accessibilityIdentifier: String? = nil,
    action: @escaping () -> Void
) -> some View {
    ReguertaFloatingActionButtonView(
        title: Text(title),
        isEnabled: isEnabled,
        accessibilityIdentifier: accessibilityIdentifier,
        action: action
    )
}

@ViewBuilder
func reguertaFloatingActionButton(
    verbatim title: String,
    isEnabled: Bool = true,
    accessibilityIdentifier: String? = nil,
    action: @escaping () -> Void
) -> some View {
    ReguertaFloatingActionButtonView(
        title: Text(verbatim: title),
        isEnabled: isEnabled,
        accessibilityIdentifier: accessibilityIdentifier,
        action: action
    )
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
