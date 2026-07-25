import SwiftUI

struct BylawsRouteView: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.locale) private var locale
    @Environment(\.verticalSizeClass) private var verticalSizeClass

    let tokens: ReguertaDesignTokens
    let viewModel: BylawsFeatureViewModel
    let isDevelopBuild: Bool

    var body: some View {
        routeContent
            .task(id: responseLanguage) {
                await viewModel.prepare(responseLanguage: responseLanguage)
            }
            .onDisappear {
                viewModel.handleRouteExit()
            }
            .sheet(
                item: Binding {
                    viewModel.pdfPresentation
                } set: { presentation in
                    if presentation == nil {
                        viewModel.dismissPdf()
                    }
                }
            ) { presentation in
                BylawsPdfSheetView(pdfURL: presentation.url)
            }
    }

    @ViewBuilder
    private var routeContent: some View {
        switch scrollMode {
        case .fullPage:
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: tokens.spacing.lg) {
                    questionSection

                    if let result = viewModel.answerResult {
                        answerDivider

                        answerSection(
                            result: result,
                            contentScrollsIndependently: false
                        )
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, tokens.spacing.lg)
            }
            .scrollDismissesKeyboard(.interactively)
        case .answerOnly:
            if let result = viewModel.answerResult {
                VStack(alignment: .leading, spacing: tokens.spacing.lg) {
                    questionSection
                    answerDivider
                    answerSection(
                        result: result,
                        contentScrollsIndependently: true
                    )
                    .frame(
                        maxWidth: .infinity,
                        maxHeight: .infinity,
                        alignment: .topLeading
                    )
                }
                .frame(
                    maxWidth: .infinity,
                    maxHeight: .infinity,
                    alignment: .topLeading
                )
                .padding(.bottom, tokens.spacing.lg)
            }
        }
    }

    private var questionSection: some View {
        BylawsQuestionSectionView(
            tokens: tokens,
            query: Binding {
                viewModel.queryInput
            } set: {
                viewModel.queryInput = $0
            },
            canAskQuestions: viewModel.canAskQuestions,
            isLoading: viewModel.isAsking,
            isSendEnabled: viewModel.canSendQuestion,
            consultationMessageKey: viewModel.consultationMessageKey
        ) {
            viewModel.askQuestion(responseLanguage: responseLanguage)
        } onOpenPdf: {
            viewModel.openPdf()
        }
    }

    private var answerDivider: some View {
        Divider()
            .overlay(tokens.colors.borderSubtle)
    }

    private func answerSection(
        result: BylawsConsultationResult,
        contentScrollsIndependently: Bool
    ) -> some View {
        BylawsAnswerSectionView(
            tokens: tokens,
            result: result,
            isDevelopBuild: isDevelopBuild,
            contentScrollsIndependently: contentScrollsIndependently
        ) {
            viewModel.clearResult()
        }
    }

    private var scrollMode: BylawsRouteScrollMode {
        BylawsRouteScrollMode.resolve(
            hasAnswer: viewModel.answerResult != nil,
            dynamicTypeSize: dynamicTypeSize,
            verticalSizeClass: verticalSizeClass
        )
    }

    private var responseLanguage: BylawsResponseLanguage {
        locale.language.languageCode?.identifier == "en" ? .english : .spanish
    }
}

#Preview("Respuesta con scroll local", traits: .modifier(BylawsPreviewModifier())) {
    let longQuery = "Según los estatutos, ¿qué sucede cuando dimite la coordinación general, "
        + "quién asume temporalmente todas sus funciones, durante cuánto tiempo puede hacerlo "
        + "y qué órgano debe ratificar o elegir a la persona sustituta?"
    let viewModel = BylawsFeatureViewModel.preview(
        capability: .localModel,
        pdfURL: BylawsPreviewFixtures.pdfURL,
        queryInput: longQuery,
        answerResult: .preview(article: BylawsPreviewFixtures.longestArticle)
    )
    BylawsRouteView(
        tokens: .light,
        viewModel: viewModel,
        isDevelopBuild: true
    )
    .padding()
}

#Preview("Respuesta XXX Large", traits: .modifier(BylawsPreviewModifier())) {
    let viewModel = BylawsFeatureViewModel.preview(
        capability: .localModel,
        pdfURL: BylawsPreviewFixtures.pdfURL,
        queryInput: "¿Qué ocurre si dimite la coordinación general?",
        answerResult: .preview(article: BylawsPreviewFixtures.longestArticle)
    )
    BylawsRouteView(
        tokens: .light,
        viewModel: viewModel,
        isDevelopBuild: false
    )
    .padding()
    .environment(\.dynamicTypeSize, .xxxLarge)
}

#Preview("Respuesta compacta", traits: .modifier(BylawsPreviewModifier())) {
    let viewModel = BylawsFeatureViewModel.preview(
        capability: .localModel,
        pdfURL: BylawsPreviewFixtures.pdfURL,
        queryInput: "¿Qué ocurre si dimite la coordinación general?",
        answerResult: .preview(article: BylawsPreviewFixtures.longestArticle)
    )
    BylawsRouteView(
        tokens: .light,
        viewModel: viewModel,
        isDevelopBuild: false
    )
    .padding()
    .environment(\.verticalSizeClass, .compact)
}

#Preview("Respuesta AX5", traits: .modifier(BylawsPreviewModifier())) {
    let viewModel = BylawsFeatureViewModel.preview(
        capability: .localModel,
        pdfURL: BylawsPreviewFixtures.pdfURL,
        queryInput: "¿Qué ocurre si dimite la coordinación general?",
        answerResult: .preview(article: BylawsPreviewFixtures.longestArticle)
    )
    BylawsRouteView(
        tokens: .light,
        viewModel: viewModel,
        isDevelopBuild: false
    )
    .padding()
    .environment(\.dynamicTypeSize, .accessibility5)
}

#Preview("Error de consulta EN AX5", traits: .modifier(BylawsPreviewModifier())) {
    let viewModel = BylawsFeatureViewModel.preview(
        capability: .localModel,
        pdfURL: BylawsPreviewFixtures.pdfURL,
        queryInput: "¿Los estatutos regulan el aparcamiento?",
        consultationMessageKey: AccessL10nKey.bylawsEvidenceInsufficient
    )
    BylawsRouteView(
        tokens: .light,
        viewModel: viewModel,
        isDevelopBuild: true
    )
    .padding()
    .environment(\.locale, Locale(identifier: "en"))
    .environment(\.dynamicTypeSize, .accessibility5)
}

#Preview("Consulta local", traits: .modifier(BylawsPreviewModifier())) {
    let viewModel = BylawsFeatureViewModel.preview(
        capability: .localModel,
        pdfURL: BylawsPreviewFixtures.pdfURL
    )
    BylawsRouteView(
        tokens: .light,
        viewModel: viewModel,
        isDevelopBuild: true
    )
    .padding()
}

#Preview("Solo PDF AX5", traits: .modifier(BylawsPreviewModifier())) {
    let viewModel = BylawsFeatureViewModel.preview(
        capability: .pdfOnly,
        pdfURL: BylawsPreviewFixtures.pdfURL
    )
    BylawsRouteView(
        tokens: .light,
        viewModel: viewModel,
        isDevelopBuild: false
    )
    .padding()
    .environment(\.dynamicTypeSize, .accessibility5)
}
