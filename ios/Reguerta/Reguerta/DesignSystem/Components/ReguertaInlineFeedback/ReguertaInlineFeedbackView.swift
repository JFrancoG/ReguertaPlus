import SwiftUI

struct ReguertaInlineFeedbackView: View {
    @Environment(\.reguertaTokens) private var tokens

    let viewModel: ReguertaInlineFeedbackViewModel

    var body: some View {
        HStack(spacing: tokens.spacing.sm) {
            Text("•")
                .font(tokens.typography.body)
                .foregroundStyle(viewModel.color(tokens: tokens))
            Text(viewModel.message)
                .font(tokens.typography.label)
                .foregroundStyle(viewModel.color(tokens: tokens))
        }
    }
}

#Preview("ReguertaInlineFeedback") {
    VStack(alignment: .leading, spacing: 12) {
        reguertaInlineFeedback("Info", kind: .info)
        reguertaInlineFeedback("Warning", kind: .warning)
        reguertaInlineFeedback("Error", kind: .error)
    }
    .padding()
}
