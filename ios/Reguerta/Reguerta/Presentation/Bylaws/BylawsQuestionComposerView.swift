import SwiftUI

struct BylawsQuestionComposerView: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    let tokens: ReguertaDesignTokens
    @Binding var query: String
    let isLoading: Bool
    let isSendEnabled: Bool
    let onSend: () -> Void

    var body: some View {
        let layout = dynamicTypeSize >= .xxxLarge
            ? AnyLayout(VStackLayout(alignment: .trailing, spacing: tokens.spacing.sm))
            : AnyLayout(HStackLayout(alignment: .bottom, spacing: tokens.spacing.sm))

        layout {
            TextField(
                LocalizedStringKey(AccessL10nKey.bylawsInputLabel),
                text: $query,
                prompt: Text(LocalizedStringKey(AccessL10nKey.bylawsInputPlaceholder)),
                axis: .vertical
            )
            .textFieldStyle(.plain)
            .font(tokens.typography.bodySecondary)
            .lineLimit(2 ... 6)
            .frame(maxWidth: .infinity, alignment: .leading)
            .disabled(isLoading)
            .accessibilityLabel(Text(LocalizedStringKey(AccessL10nKey.bylawsInputLabel)))

            if isLoading {
                ProgressView()
                    .tint(tokens.colors.actionPrimary)
                    .frame(minWidth: 44, minHeight: 44)
                    .accessibilityLabel(
                        Text(LocalizedStringKey(AccessL10nKey.bylawsAskLoading))
                    )
            } else {
                Button {
                    onSend()
                } label: {
                    Image(systemName: "paperplane.fill")
                        .font(.title3)
                        .foregroundStyle(
                            isSendEnabled
                                ? tokens.colors.actionPrimary
                                : tokens.colors.textSecondary.opacity(0.45)
                        )
                        .frame(minWidth: 44, minHeight: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(!isSendEnabled)
                .accessibilityLabel(Text(LocalizedStringKey(AccessL10nKey.bylawsAskAction)))
            }
        }
        .padding(.leading, tokens.spacing.md)
        .padding(.trailing, tokens.spacing.xs)
        .padding(.vertical, tokens.spacing.sm)
        .background(tokens.colors.surfaceSecondary.opacity(0.35))
        .overlay {
            RoundedRectangle(cornerRadius: tokens.radius.md)
                .stroke(tokens.colors.borderSubtle, lineWidth: 1)
        }
        .compositingGroup()
        .clipShape(RoundedRectangle(cornerRadius: tokens.radius.md))
    }
}

#Preview("Compositor", traits: .modifier(BylawsPreviewModifier())) {
    @Previewable @State var query = "¿Qué ocurre si dimite la coordinación general?"

    BylawsQuestionComposerView(
        tokens: .light,
        query: $query,
        isLoading: false,
        isSendEnabled: true,
        onSend: {}
    )
    .padding()
}
