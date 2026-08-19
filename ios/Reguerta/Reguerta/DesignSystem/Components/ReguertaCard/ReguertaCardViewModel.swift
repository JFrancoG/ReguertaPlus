import SwiftUI

struct ReguertaCardViewModel {
    let maxWidth: CGFloat?
    let alignment: Alignment

    static let `default` = ReguertaCardViewModel(
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
        viewModel: .default,
        content: content
    )
}
