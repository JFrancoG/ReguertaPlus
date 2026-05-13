import SwiftUI

struct ReguertaCardView<Content: View>: View {
    @Environment(\.reguertaTokens) private var tokens

    let viewModel: ReguertaCardViewModel
    let content: () -> Content

    var body: some View {
        content()
            .padding(tokens.spacing.lg)
            .frame(maxWidth: viewModel.maxWidth, alignment: viewModel.alignment)
            .background(tokens.colors.surfacePrimary)
            .overlay(
                RoundedRectangle(cornerRadius: tokens.radius.md)
                    .stroke(tokens.colors.borderSubtle, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: tokens.radius.md))
    }
}

#Preview("ReguertaCard") {
    reguertaCard {
        VStack(alignment: .leading, spacing: 8) {
            Text("Card title")
                .font(.headline)
            Text("Card body")
                .font(.subheadline)
        }
    }
    .padding()
}
