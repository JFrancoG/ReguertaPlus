import PDFKit
import SwiftUI

extension ContentView {
    var bylawsRoute: some View {
        BylawsRouteView(
            tokens: tokens,
            query: Binding(
                get: { viewModel.bylawsQueryInput },
                set: { viewModel.bylawsQueryInput = $0 }
            ),
            answerResult: viewModel.bylawsAnswerResult,
            isLoading: viewModel.isAskingBylaws,
            pdfURL: viewModel.bylawsPdfURL(),
            onAsk: viewModel.askBylawsQuestion,
            onClear: viewModel.clearBylawsResult,
            onPdfUnavailable: {
                viewModel.feedbackMessageKey = AccessL10nKey.bylawsPdfViewerUnavailable
            }
        )
    }
}

private struct BylawsRouteView: View {
    let tokens: ReguertaDesignTokens
    @Binding var query: String
    let answerResult: BylawsAnswerResult?
    let isLoading: Bool
    let pdfURL: URL?
    let onAsk: () -> Void
    let onClear: () -> Void
    let onPdfUnavailable: () -> Void

    @State private var isPdfPresented = false

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            ReguertaCard {
                VStack(alignment: .leading, spacing: tokens.spacing.md) {
                    Text(LocalizedStringKey(AccessL10nKey.bylawsTitle))
                        .font(tokens.typography.titleCard)
                    Text(LocalizedStringKey(AccessL10nKey.bylawsSubtitle))
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)

                    Text(LocalizedStringKey(AccessL10nKey.bylawsInputLabel))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.textSecondary)

                    TextField(
                        "",
                        text: $query,
                        prompt: Text(LocalizedStringKey(AccessL10nKey.bylawsInputPlaceholder)),
                        axis: .vertical
                    )
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(2 ... 6)
                    .disabled(isLoading)

                    ReguertaButton(
                        LocalizedStringKey(isLoading ? AccessL10nKey.bylawsAskLoading : AccessL10nKey.bylawsAskAction),
                        isEnabled: !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                        isLoading: isLoading,
                        action: onAsk
                    )

                    ReguertaButton(
                        LocalizedStringKey(AccessL10nKey.bylawsOpenPdfAction),
                        variant: .text
                    ) {
                        guard pdfURL != nil else {
                            onPdfUnavailable()
                            return
                        }
                        isPdfPresented = true
                    }
                }
            }

            if let answerResult {
                BylawsAnswerCardView(
                    tokens: tokens,
                    answerResult: answerResult,
                    onClear: onClear
                )
            }
        }
        .sheet(isPresented: $isPdfPresented) {
            if let pdfURL {
                BylawsPdfSheetView(pdfURL: pdfURL)
            } else {
                ReguertaCard {
                    Text(LocalizedStringKey(AccessL10nKey.bylawsPdfViewerUnavailable))
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)
                }
                .padding(tokens.spacing.lg)
            }
        }
    }
}

private struct BylawsAnswerCardView: View {
    let tokens: ReguertaDesignTokens
    let answerResult: BylawsAnswerResult
    let onClear: () -> Void

    private var modeKey: String {
        switch answerResult.mode {
        case .local:
            return AccessL10nKey.bylawsModeLocal
        case .cloud:
            return AccessL10nKey.bylawsModeCloud
        case .fallback:
            return AccessL10nKey.bylawsModeFallback
        }
    }

    private var traceReasons: String {
        answerResult.trace.reasons.joined(separator: ", ").isEmpty
            ? "sin_escalado"
            : answerResult.trace.reasons.joined(separator: ", ")
    }

    var body: some View {
        ReguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(LocalizedStringKey(modeKey))
                    .font(tokens.typography.titleCard)

                Text(
                    l10n(
                        AccessL10nKey.bylawsTraceFormat,
                        String(format: "%.2f", answerResult.trace.localCoverage),
                        String(format: "%.2f", answerResult.trace.localConfidence),
                        traceReasons
                    )
                )
                .font(tokens.typography.label)
                .foregroundStyle(tokens.colors.textSecondary)

                if !answerResult.citedPages.isEmpty {
                    Text(
                        l10n(
                            AccessL10nKey.bylawsPagesFormat,
                            answerResult.citedPages.map(String.init).joined(separator: ", ")
                        )
                    )
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
                }

                Text(answerResult.answer)
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textPrimary)

                ReguertaButton(
                    LocalizedStringKey(AccessL10nKey.commonClear),
                    variant: .text,
                    action: onClear
                )
            }
        }
    }
}

private struct BylawsPdfSheetView: View {
    @Environment(\.dismiss) private var dismiss

    let pdfURL: URL

    var body: some View {
        NavigationStack {
            BylawsPdfView(url: pdfURL)
                .navigationTitle(LocalizedStringKey(AccessL10nKey.bylawsTitle))
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button(LocalizedStringKey(AccessL10nKey.commonActionClose)) {
                            dismiss()
                        }
                    }
                }
        }
    }
}

private struct BylawsPdfView: UIViewRepresentable {
    let url: URL

    func makeUIView(context _: Context) -> PDFView {
        let pdfView = PDFView()
        pdfView.autoScales = true
        pdfView.displayMode = .singlePageContinuous
        pdfView.displayDirection = .vertical
        pdfView.document = PDFDocument(url: url)
        return pdfView
    }

    func updateUIView(_ uiView: PDFView, context _: Context) {
        if uiView.document?.documentURL != url {
            uiView.document = PDFDocument(url: url)
        }
    }
}
