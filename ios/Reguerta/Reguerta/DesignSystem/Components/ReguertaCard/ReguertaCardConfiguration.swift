import SwiftUI

struct ReguertaCardConfiguration {
    let maxWidth: CGFloat?
    let alignment: Alignment

    static let `default` = ReguertaCardConfiguration(
        maxWidth: .infinity,
        alignment: .leading
    )
}

@MainActor
@ViewBuilder
func reguertaCard<Content: View>(
    @ViewBuilder content: @escaping () -> Content
) -> some View {
    ReguertaCardView(
        configuration: .default,
        content: content
    )
}
