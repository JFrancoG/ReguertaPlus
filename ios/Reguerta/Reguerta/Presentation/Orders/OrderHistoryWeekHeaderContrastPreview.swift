import SwiftUI

private struct OrderHistoryWeekHeaderContrastPreview: View {
    @Environment(\.reguertaTokens) private var tokens

    var body: some View {
        OrderHistoryWeekHeader(
            tokens: tokens,
            selectedWeek: nil,
            canGoPrevious: true,
            canGoNext: false,
            onPrevious: {},
            onNext: {},
            onPickWeek: {}
        )
        .padding()
        .background(
            LinearGradient(
                colors: [.purple.opacity(0.32), .orange.opacity(0.28)],
                startPoint: .leading,
                endPoint: .trailing
            )
        )
    }
}

#Preview("Glass week navigation", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    OrderHistoryWeekHeaderContrastPreview()
}
