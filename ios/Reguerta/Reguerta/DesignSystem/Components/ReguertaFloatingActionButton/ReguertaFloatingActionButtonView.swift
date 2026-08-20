import SwiftUI

enum ReguertaFloatingActionButtonLayout {
    static let minimumHeight: CGFloat = 52
    static let bottomPadding: CGFloat = 8
    static let shadowRadius: CGFloat = 14
    static let shadowVerticalOffset: CGFloat = 6
}

struct ReguertaFloatingActionButtonView: View {
    @Environment(\.reguertaTokens) private var tokens

    let title: Text
    let isEnabled: Bool
    let accessibilityIdentifier: String?
    var bottomPadding: CGFloat = ReguertaFloatingActionButtonLayout.bottomPadding
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
                .frame(
                    minHeight: max(
                        ReguertaFloatingActionButtonLayout.minimumHeight,
                        tokens.layout.minimumTouchTarget
                    )
                )
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
        .shadow(
            color: .black.opacity(0.18),
            radius: ReguertaFloatingActionButtonLayout.shadowRadius,
            y: ReguertaFloatingActionButtonLayout.shadowVerticalOffset
        )
        .reguertaOptionalAccessibilityIdentifier(accessibilityIdentifier)
    }
}

#Preview(
    "Floating actions",
    traits: .modifier(ReguertaDesignSystemPreviewModifier(fixture: .fabStates)),
    .fixedLayout(width: 320, height: 640)
) {
    VStack(spacing: 16) {
        ReguertaFloatingActionButtonView(
            title: Text(verbatim: "Save changes"),
            isEnabled: true,
            accessibilityIdentifier: nil,
            bottomPadding: ReguertaFloatingActionButtonLayout.bottomPadding
        ) {}
        ReguertaFloatingActionButtonView(
            title: Text(verbatim: "Unavailable"),
            isEnabled: false,
            accessibilityIdentifier: nil,
            bottomPadding: ReguertaFloatingActionButtonLayout.bottomPadding
        ) {}
    }
    .padding(.vertical)
}

#Preview(
    "Floating action XXX",
    traits: .modifier(ReguertaDesignSystemPreviewModifier(fixture: .fabXXX)),
    .fixedLayout(width: 600, height: 820)
) {
    reguertaFloatingActionButton(verbatim: "Save the updated community delivery instructions") {}
        .padding(.vertical)
}

#Preview(
    "Floating action AX5 · external Increased Contrast override",
    traits: .modifier(ReguertaDesignSystemPreviewModifier(fixture: .fabAccessibility)),
    .fixedLayout(width: 320, height: 720)
) {
    reguertaFloatingActionButton(verbatim: "Unavailable while the order is being processed", isEnabled: false) {}
        .padding(.vertical)
}

@MainActor
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

@MainActor
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
