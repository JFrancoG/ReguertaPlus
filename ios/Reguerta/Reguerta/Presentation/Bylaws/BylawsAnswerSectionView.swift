import SwiftUI

struct BylawsAnswerSectionView: View {
    let tokens: ReguertaDesignTokens
    let result: BylawsConsultationResult
    let isDevelopBuild: Bool
    let contentScrollsIndependently: Bool
    let onClear: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.md) {
            HStack(alignment: .firstTextBaseline) {
                Text(LocalizedStringKey(AccessL10nKey.bylawsSummaryTitle))
                    .font(tokens.typography.titleCard)
                    .accessibilityAddTraits(.isHeader)

                Spacer()

                Button {
                    onClear()
                } label: {
                    Image(systemName: "trash")
                        .font(.body)
                        .foregroundStyle(tokens.colors.feedbackError)
                        .frame(minWidth: 44, minHeight: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(Text(LocalizedStringKey(AccessL10nKey.commonClear)))
            }

            if contentScrollsIndependently {
                ScrollView(.vertical) {
                    BylawsAnswerContentView(
                        tokens: tokens,
                        result: result,
                        isDevelopBuild: isDevelopBuild
                    )
                    .padding(.bottom, tokens.spacing.lg)
                }
                .scrollDismissesKeyboard(.interactively)
            } else {
                BylawsAnswerContentView(
                    tokens: tokens,
                    result: result,
                    isDevelopBuild: isDevelopBuild
                )
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

#Preview("Respuesta con evidencia", traits: .modifier(BylawsPreviewModifier())) {
    ScrollView {
        BylawsAnswerSectionView(
            tokens: .light,
            result: .preview(article: BylawsPreviewFixtures.longestArticle),
            isDevelopBuild: true,
            contentScrollsIndependently: false
        ) {}
        .padding()
    }
}

#Preview("Respuesta AX5", traits: .modifier(BylawsPreviewModifier())) {
    ScrollView {
        BylawsAnswerSectionView(
            tokens: .light,
            result: .preview(article: BylawsPreviewFixtures.longestArticle),
            isDevelopBuild: false,
            contentScrollsIndependently: false
        ) {}
        .padding()
    }
    .environment(\.dynamicTypeSize, .accessibility5)
}

#Preview("Cabecera fija y respuesta desplazable", traits: .modifier(BylawsPreviewModifier())) {
    BylawsAnswerSectionView(
        tokens: .light,
        result: .preview(article: BylawsPreviewFixtures.longestArticle),
        isDevelopBuild: true,
        contentScrollsIndependently: true
    ) {}
    .padding()
}
