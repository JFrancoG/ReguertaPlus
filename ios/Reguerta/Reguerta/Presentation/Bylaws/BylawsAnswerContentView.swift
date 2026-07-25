import SwiftUI

struct BylawsAnswerContentView: View {
    let tokens: ReguertaDesignTokens
    let result: BylawsConsultationResult
    let isDevelopBuild: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.md) {
            Text(result.summary)
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.textPrimary)

            Text(LocalizedStringKey(AccessL10nKey.bylawsSummaryDisclaimer))
                .font(tokens.typography.labelRegular)
                .foregroundStyle(tokens.colors.textSecondary)

            Text(LocalizedStringKey(AccessL10nKey.bylawsEvidenceTitle))
                .font(tokens.typography.label)
                .foregroundStyle(tokens.colors.textSecondary)
                .accessibilityAddTraits(.isHeader)

            ForEach(result.evidence) { evidence in
                VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                    Text(evidence.title)
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.textPrimary)
                        .accessibilityAddTraits(.isHeader)

                    Text(
                        l10n(
                            AccessL10nKey.bylawsEvidencePagesFormat,
                            pageDescription(for: evidence)
                        )
                    )
                    .font(tokens.typography.labelRegular)
                    .foregroundStyle(tokens.colors.textSecondary)

                    Text(evidence.excerpt)
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textPrimary)
                }
                .padding(tokens.spacing.md)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(tokens.colors.surfaceSecondary.opacity(0.25))
                .compositingGroup()
                .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))
            }

            if isDevelopBuild {
                VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                    Text(LocalizedStringKey(AccessL10nKey.bylawsDevelopDetailsTitle))
                        .font(tokens.typography.label)

                    Text(
                        l10n(
                            AccessL10nKey.bylawsDiagnosticsModelFormat,
                            result.diagnostics.modelIdentifier
                        )
                    )

                    ForEach(result.diagnostics.retrieval, id: \.sourceID) { diagnostic in
                        Text(
                            l10n(
                                AccessL10nKey.bylawsDiagnosticsRetrievalFormat,
                                diagnostic.sourceID,
                                diagnostic.score
                            )
                        )
                    }
                }
                .font(tokens.typography.labelRegular)
                .foregroundStyle(tokens.colors.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func pageDescription(for evidence: BylawsSourceEvidence) -> String {
        evidence.pageStart == evidence.pageEnd
            ? String(evidence.pageStart)
            : "\(evidence.pageStart)–\(evidence.pageEnd)"
    }
}

#Preview("Contenido de respuesta", traits: .modifier(BylawsPreviewModifier())) {
    ScrollView {
        BylawsAnswerContentView(
            tokens: .light,
            result: .preview(article: BylawsPreviewFixtures.longestArticle),
            isDevelopBuild: false
        )
        .padding()
    }
}
