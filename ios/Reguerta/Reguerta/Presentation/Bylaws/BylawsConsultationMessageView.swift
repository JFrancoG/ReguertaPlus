import SwiftUI

struct BylawsConsultationMessageView: View {
    let tokens: ReguertaDesignTokens
    let messageKey: String

    var body: some View {
        Label {
            Text(LocalizedStringKey(messageKey))
        } icon: {
            Image(systemName: "info.circle.fill")
                .foregroundStyle(tokens.colors.feedbackWarning)
        }
        .font(tokens.typography.bodySecondary)
        .foregroundStyle(tokens.colors.textSecondary)
        .padding(tokens.spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(tokens.colors.surfaceSecondary.opacity(0.35))
        .clipShape(RoundedRectangle(cornerRadius: tokens.radius.md))
        .accessibilityElement(children: .combine)
    }
}

#Preview("Aviso de consulta AX5", traits: .modifier(BylawsPreviewModifier())) {
    BylawsConsultationMessageView(
        tokens: .light,
        messageKey: AccessL10nKey.bylawsEvidenceInsufficient
    )
    .padding()
    .environment(\.locale, Locale(identifier: "en"))
    .environment(\.dynamicTypeSize, .accessibility5)
}
