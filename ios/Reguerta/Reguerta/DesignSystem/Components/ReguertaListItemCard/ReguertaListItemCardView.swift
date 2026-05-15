import SwiftUI

struct ReguertaListItemCardView<Content: View>: View {
    @Environment(\.reguertaTokens) private var tokens

    let isHighlighted: Bool
    let content: () -> Content

    init(
        isHighlighted: Bool = false,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.isHighlighted = isHighlighted
        self.content = content
    }

    var body: some View {
        content()
            .frame(width: 358.resize)
            .background(tokens.colors.actionPrimary.opacity(0.15))
            .clipShape(RoundedRectangle(cornerRadius: 16.resize))
            .overlay(
                RoundedRectangle(cornerRadius: 12.resize)
                    .stroke(tokens.colors.actionPrimary.opacity(isHighlighted ? 0.9 : 0), lineWidth: 3.resize)
            )
            .background(
                RoundedRectangle(cornerRadius: 12.resize)
                    .fill(tokens.colors.actionPrimary.opacity(isHighlighted ? 0.22 : 0))
            )
            .shadow(
                color: tokens.colors.actionPrimary.opacity(isHighlighted ? 0.25 : 0),
                radius: isHighlighted ? 10.resize : 0,
                x: 0,
                y: 4
            )
            .animation(.easeInOut(duration: 0.25), value: isHighlighted)
    }
}

struct ReguertaListActionIconButton: View {
    let systemImageName: String
    let accessibilityLabel: String
    let backgroundColor: Color
    var size: CGFloat = 44.resize
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImageName)
                .font(.system(size: size * 0.58, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: size, height: size)
                .background(backgroundColor)
                .clipShape(RoundedRectangle(cornerRadius: 12.resize))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(verbatim: accessibilityLabel))
    }
}

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
