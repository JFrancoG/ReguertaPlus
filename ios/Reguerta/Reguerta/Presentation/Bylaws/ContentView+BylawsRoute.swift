import PDFKit
import SwiftUI

extension AccessRootRoutingView {
    var bylawsRoute: some View {
        BylawsRouteView(
            tokens: tokens,
            viewModel: rootViewModel.bylawsViewModel,
            isDevelopBuild: viewModel.isDevelopImpersonationEnabled
        )
    }
}

private struct BylawsRouteView: View {
    let tokens: ReguertaDesignTokens
    let viewModel: BylawsFeatureViewModel
    let isDevelopBuild: Bool

    @State private var isPdfPresented = false

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: tokens.spacing.lg) {
                VStack(alignment: .leading, spacing: tokens.spacing.md) {
                    Text(LocalizedStringKey(AccessL10nKey.bylawsSubtitle))
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)

                    Text(LocalizedStringKey(AccessL10nKey.bylawsInputLabel))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.textSecondary)

                    BylawsQuestionComposerView(
                        tokens: tokens,
                        query: Binding(
                            get: { viewModel.queryInput },
                            set: { viewModel.queryInput = $0 }
                        ),
                        isLoading: viewModel.isAsking,
                        onSend: viewModel.askQuestion
                    )

                    Button {
                        guard viewModel.pdfURL() != nil else {
                            viewModel.reportPdfUnavailable()
                            return
                        }
                        isPdfPresented = true
                    } label: {
                        Text(LocalizedStringKey(AccessL10nKey.bylawsOpenPdfAction))
                            .font(tokens.typography.labelRegular)
                            .foregroundStyle(tokens.colors.actionPrimary)
                            .padding(.vertical, tokens.spacing.sm)
                    }
                    .buttonStyle(.plain)
                    .disabled(viewModel.isAsking)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                if let answerResult = viewModel.answerResult {
                    Divider()
                        .overlay(tokens.colors.borderSubtle)

                    BylawsAnswerSectionView(
                        tokens: tokens,
                        answerResult: answerResult,
                        isDevelopBuild: isDevelopBuild,
                        onClear: viewModel.clearResult
                    )
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.bottom, tokens.spacing.lg)
        }
        .scrollDismissesKeyboard(.interactively)
        .sheet(isPresented: $isPdfPresented) {
            if let pdfURL = viewModel.pdfURL() {
                BylawsPdfSheetView(pdfURL: pdfURL)
            } else {
                reguertaCard {
                    Text(LocalizedStringKey(AccessL10nKey.bylawsPdfViewerUnavailable))
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)
                }
                .padding(tokens.spacing.lg)
            }
        }
    }
}

private struct BylawsQuestionComposerView: View {
    let tokens: ReguertaDesignTokens
    @Binding var query: String
    let isLoading: Bool
    let onSend: () -> Void

    private var isSendEnabled: Bool {
        !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isLoading
    }

    var body: some View {
        HStack(alignment: .bottom, spacing: tokens.spacing.sm) {
            TextField(
                "",
                text: $query,
                prompt: Text(LocalizedStringKey(AccessL10nKey.bylawsInputPlaceholder)),
                axis: .vertical
            )
            .textFieldStyle(.plain)
            .font(tokens.typography.bodySecondary)
            .lineLimit(3 ... 6)
            .disabled(isLoading)

            if isLoading {
                ProgressView()
                    .tint(tokens.colors.actionPrimary)
                    .frame(width: 44.resize, height: 44.resize)
            } else {
                Button(action: onSend) {
                    Image(systemName: "paperplane.fill")
                        .font(.title3)
                        .foregroundStyle(
                            isSendEnabled
                                ? tokens.colors.actionPrimary
                                : tokens.colors.textSecondary.opacity(0.45)
                        )
                        .frame(width: 44.resize, height: 44.resize)
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

private struct BylawsAnswerSectionView: View {
    let tokens: ReguertaDesignTokens
    let answerResult: BylawsAnswerResult
    let isDevelopBuild: Bool
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
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            HStack {
                Text(LocalizedStringKey(AccessL10nKey.bylawsAnswerTitle))
                    .font(tokens.typography.titleCard)

                Spacer()

                Button(action: onClear) {
                    Image(systemName: "trash")
                        .font(.body)
                        .foregroundStyle(tokens.colors.feedbackError)
                        .frame(width: 44.resize, height: 44.resize)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(Text(LocalizedStringKey(AccessL10nKey.commonClear)))
            }

            Text(answerResult.answer)
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.textPrimary)

            if isDevelopBuild {
                Text(LocalizedStringKey(AccessL10nKey.bylawsDevelopDetailsTitle))
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)

                Text(LocalizedStringKey(modeKey))
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)

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
