import SwiftUI

struct BylawsQuestionSectionView: View {
    @AccessibilityFocusState private var isConsultationMessageFocused: Bool

    let tokens: ReguertaDesignTokens
    @Binding var query: String
    let canAskQuestions: Bool
    let isLoading: Bool
    let isSendEnabled: Bool
    let consultationMessageKey: String?
    let onSend: () -> Void
    let onOpenPdf: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.md) {
            Text(LocalizedStringKey(AccessL10nKey.bylawsSubtitle))
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.textSecondary)

            if canAskQuestions {
                Text(LocalizedStringKey(AccessL10nKey.bylawsInputLabel))
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)

                BylawsQuestionComposerView(
                    tokens: tokens,
                    query: $query,
                    isLoading: isLoading,
                    isSendEnabled: isSendEnabled
                ) {
                    onSend()
                }

                if let consultationMessageKey {
                    BylawsConsultationMessageView(
                        tokens: tokens,
                        messageKey: consultationMessageKey
                    )
                    .accessibilityFocused($isConsultationMessageFocused)
                }
            } else {
                Text(LocalizedStringKey(AccessL10nKey.bylawsPdfOnlyMessage))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
                    .padding(tokens.spacing.md)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(tokens.colors.surfaceSecondary.opacity(0.35))
                    .compositingGroup()
                    .clipShape(RoundedRectangle(cornerRadius: tokens.radius.md))
            }

            Button {
                onOpenPdf()
            } label: {
                Text(LocalizedStringKey(AccessL10nKey.bylawsOpenPdfAction))
                    .font(tokens.typography.labelRegular)
                    .foregroundStyle(tokens.colors.actionPrimary)
                    .padding(.vertical, tokens.spacing.sm)
                    .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .onChange(of: consultationMessageKey) { _, messageKey in
            isConsultationMessageFocused = messageKey != nil
        }
    }
}

#Preview("Consulta", traits: .modifier(BylawsPreviewModifier())) {
    @Previewable @State var query = "¿Qué ocurre si dimite la coordinación general?"

    BylawsQuestionSectionView(
        tokens: .light,
        query: $query,
        canAskQuestions: true,
        isLoading: false,
        isSendEnabled: true,
        consultationMessageKey: nil
    ) {
    } onOpenPdf: {
    }
    .padding()
}
