import SwiftUI

struct ReguertaInputMessageView: View {
    @Environment(\.reguertaTokens) private var tokens

    let errorMessage: LocalizedStringKey?
    let helperMessage: LocalizedStringKey?

    var body: some View {
        if let errorMessage {
            Text(errorMessage)
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.feedbackError)
                .accessibilityHidden(true)
        } else if let helperMessage {
            Text(helperMessage)
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.textSecondary)
        }
    }
}

#Preview(
    "Input error message · Large",
    traits: .modifier(ReguertaDesignSystemPreviewModifier(fixture: .inputCompact)),
    .fixedLayout(width: 320, height: 640)
) {
    ReguertaInputMessageView(
        errorMessage: LocalizedStringKey(AccessL10nKey.feedbackEmailInvalid),
        helperMessage: nil
    )
    .padding()
}
