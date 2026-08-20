import SwiftUI

enum ReguertaListItemCardLayout {
    static let defaultActionSize: CGFloat = 44
    static let actionIconScale: CGFloat = 0.58
    static let cardCornerRadius: CGFloat = 16
    static let highlightCornerRadius: CGFloat = 12
    static let highlightStrokeWidth: CGFloat = 3
    static let highlightShadowRadius: CGFloat = 10
    static let highlightShadowVerticalOffset: CGFloat = 4

    static func actionTargetSize(requestedSize: CGFloat, minimumTouchTarget: CGFloat) -> CGFloat {
        max(requestedSize, minimumTouchTarget)
    }
}

struct ReguertaListItemCardView<Content: View>: View {
    @Environment(\.reguertaMotionPolicy) private var motionPolicy
    @Environment(\.reguertaTokens) private var tokens

    let isHighlighted: Bool
    private let storedContent: () -> Content

    var body: some View {
        storedContent()
            .frame(maxWidth: .infinity)
            .background(tokens.colors.actionPrimary.opacity(0.15))
            .clipShape(RoundedRectangle(cornerRadius: ReguertaListItemCardLayout.cardCornerRadius))
            .overlay(
                RoundedRectangle(cornerRadius: ReguertaListItemCardLayout.highlightCornerRadius)
                    .stroke(
                        tokens.colors.actionPrimary.opacity(isHighlighted ? 0.9 : 0),
                        lineWidth: ReguertaListItemCardLayout.highlightStrokeWidth
                    )
            )
            .background(
                RoundedRectangle(cornerRadius: ReguertaListItemCardLayout.highlightCornerRadius)
                    .fill(tokens.colors.actionPrimary.opacity(isHighlighted ? 0.22 : 0))
            )
            .shadow(
                color: tokens.colors.actionPrimary.opacity(isHighlighted ? 0.25 : 0),
                radius: isHighlighted ? ReguertaListItemCardLayout.highlightShadowRadius : 0,
                x: 0,
                y: ReguertaListItemCardLayout.highlightShadowVerticalOffset
            )
            .animation(
                motionPolicy.materialAnimation(.easeInOut(duration: tokens.motion.standardDuration)),
                value: isHighlighted
            )
    }
}

extension ReguertaListItemCardView {
    init(
        isHighlighted: Bool = false,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.isHighlighted = isHighlighted
        self.storedContent = content
    }
}

struct ReguertaListActionIconButton: View {
    @Environment(\.reguertaTokens) private var tokens

    let systemImageName: String
    let accessibilityLabel: String
    let backgroundColor: Color
    let foregroundColor: Color
    var size: CGFloat = ReguertaListItemCardLayout.defaultActionSize
    var isEnabled: Bool = true
    let action: () -> Void

    private var targetSize: CGFloat {
        ReguertaListItemCardLayout.actionTargetSize(
            requestedSize: size,
            minimumTouchTarget: tokens.layout.minimumTouchTarget
        )
    }

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImageName)
                .font(.system(size: size * ReguertaListItemCardLayout.actionIconScale, weight: .semibold))
                .foregroundStyle(foregroundColor.opacity(isEnabled ? 1 : 0.45))
                .frame(width: size, height: size)
                .background(backgroundColor.opacity(isEnabled ? 1 : 0.45))
                .clipShape(RoundedRectangle(cornerRadius: ReguertaListItemCardLayout.highlightCornerRadius))
                .frame(width: targetSize, height: targetSize)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
        .accessibilityLabel(Text(verbatim: accessibilityLabel))
    }
}

@MainActor
@ViewBuilder
func reguertaListItemCard<Content: View>(
    isHighlighted: Bool = false,
    @ViewBuilder content: @escaping () -> Content
) -> some View {
    ReguertaListItemCardView(
        isHighlighted: isHighlighted,
        content: content
    )
}

#Preview(
    "List compact",
    traits: .modifier(ReguertaDesignSystemPreviewModifier(fixture: .listCompact)),
    .fixedLayout(width: 320, height: 640)
) {
    reguertaListItemCard {
        Text(verbatim: "Seasonal vegetables")
            .font(.headline)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
    }
    .padding()
}

#Preview(
    "List item actions",
    traits: .modifier(ReguertaDesignSystemPreviewModifier(fixture: .listActions)),
    .fixedLayout(width: 600, height: 820)
) {
    reguertaListItemCard(isHighlighted: true) {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(verbatim: "Seasonal vegetable assortment with a long title")
                    .font(.headline)
                Text(verbatim: "Available this week")
                    .font(.subheadline)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            ReguertaListActionIconButton(
                systemImageName: "pencil",
                accessibilityLabel: "Edit item",
                backgroundColor: .green,
                foregroundColor: .white,
                size: 32,
                action: {}
            )
            ReguertaListActionIconButton(
                systemImageName: "trash",
                accessibilityLabel: "Delete item",
                backgroundColor: .red,
                foregroundColor: .white,
                isEnabled: false,
                action: {}
            )
        }
        .padding()
    }
    .padding()
}

#Preview(
    "List AX5 · external Increased Contrast override",
    traits: .modifier(ReguertaDesignSystemPreviewModifier(fixture: .listAccessibility)),
    .fixedLayout(width: 320, height: 720)
) {
    reguertaListItemCard(isHighlighted: true) {
        Text(verbatim: "Seasonal vegetable assortment with additional preparation details")
            .font(.headline)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
    }
    .padding()
}
