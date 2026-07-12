import SwiftUI

extension MyOrderRouteView {
    @ViewBuilder
    func badge(
        _ title: LocalizedStringKey,
        usesCompactFont: Bool = false
    ) -> some View {
        Text(title)
            .font(
                usesCompactFont
                    ? .custom("CabinSketch-Bold", size: 12.resize, relativeTo: .footnote)
                    : tokens.typography.label
            )
            .foregroundStyle(tokens.colors.actionPrimary)
            .padding(.horizontal, tokens.spacing.sm)
            .padding(.vertical, tokens.spacing.xs)
            .background(tokens.colors.actionPrimary.opacity(0.12))
            .clipShape(Capsule())
    }
}
