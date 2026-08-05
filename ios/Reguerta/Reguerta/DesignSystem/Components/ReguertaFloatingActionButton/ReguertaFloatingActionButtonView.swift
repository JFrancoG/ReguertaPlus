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
    var bottomPadding: CGFloat = 8.resizeBottomSize
    let action: () -> Void

    var body: some View {
        Button {
            action()
        } label: {
            title
                .font(tokens.typography.body.weight(.semibold))
                .foregroundStyle(isEnabled ? tokens.colors.actionOnPrimary : tokens.colors.textPrimary.opacity(0.86))
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity)
                .padding(.vertical, tokens.spacing.sm)
                .frame(minHeight: 52.resize)
                .background(
                    isEnabled ? tokens.colors.actionPrimary : tokens.colors.surfaceSecondary,
                    in: Capsule()
                )
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
        .padding(.horizontal, tokens.spacing.xl + tokens.spacing.sm)
        .padding(.bottom, bottomPadding)
        .shadow(color: .black.opacity(0.18), radius: 14.resize, y: 6.resize)
        .reguertaOptionalAccessibilityIdentifier(accessibilityIdentifier)
    }
}

#Preview("Floating action buttons", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    VStack(spacing: 16) {
        ReguertaFloatingActionButtonView(
            title: Text(verbatim: "Save changes"),
            isEnabled: true,
            accessibilityIdentifier: nil,
            bottomPadding: 8.resize
        ) {}
        ReguertaFloatingActionButtonView(
            title: Text(verbatim: "Unavailable"),
            isEnabled: false,
            accessibilityIdentifier: nil,
            bottomPadding: 8.resize
        ) {}
    }
    .padding(.vertical)
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
    @ViewBuilder func reguertaOptionalAccessibilityIdentifier(_ identifier: String?) -> some View {
        if let identifier {
            accessibilityIdentifier(identifier)
        } else {
            self
        }
    }
}
