import Foundation

nonisolated struct ConsultBylawsUseCase: BylawsConsulting {
    private let knowledgeIndexProvider: any BylawsKnowledgeProviding
    private let retriever: any BylawsRetrieving
    private let questionScopeClassifier: any BylawsQuestionScopeClassifying
    private let summaryGenerator: any BylawsSummaryGenerating

    func capability(
        for responseLanguage: BylawsResponseLanguage
    ) async -> BylawsConsultationCapability {
        await summaryGenerator.capability(for: responseLanguage)
    }

    /// Produces an on-device, evidence-grounded answer to a bylaws question.
    ///
    /// The operation requires a local model, retrieves at most three canonical articles before
    /// classifying an unsupported question, and generates prose only from the resulting evidence.
    /// The generated summary may not claim its own article or page references; deterministic
    /// citations and excerpts in the returned evidence remain the source of truth.
    ///
    /// - Parameters:
    ///   - question: The member's question, kept on device.
    ///   - responseLanguage: The language requested for generated explanatory prose.
    /// - Returns: A normalized summary with deterministic evidence and develop diagnostics.
    /// - Throws: `BylawsConsultationError` when the model is unavailable, evidence is absent,
    ///   the question is clearly unrelated, or generated output fails validation; cancellation
    ///   is propagated as `CancellationError`.
    func consult(
        question: String,
        responseLanguage: BylawsResponseLanguage
    ) async throws -> BylawsConsultationResult {
        try Task.checkCancellation()
        guard await summaryGenerator.capability(for: responseLanguage) == .localModel else {
            throw BylawsConsultationError.modelUnavailable
        }

        let index = try await loadIndex()
        try Task.checkCancellation()
        let matches = retriever.retrieve(
            question: question,
            in: index.articles,
            maxResults: 3
        )
        guard !matches.isEmpty else {
            let scope = questionScopeClassifier.classify(question: question)
            throw scope == .clearlyUnrelated
                ? BylawsConsultationError.unrelatedQuestion
                : BylawsConsultationError.noEvidence
        }

        let evidence = makeEvidence(from: matches)
        let summary = try await generateSummary(
            question: question,
            evidence: evidence,
            responseLanguage: responseLanguage
        )
        try Task.checkCancellation()
        let normalizedSummary = summary.trimmingCharacters(in: .whitespacesAndNewlines)
        switch validationResult(for: normalizedSummary) {
        case .valid:
            break
        case .noEvidence:
            throw BylawsConsultationError.noEvidence
        case .invalid:
            throw BylawsConsultationError.generationFailed
        }

        return BylawsConsultationResult(
            summary: normalizedSummary,
            evidence: evidence,
            diagnostics: BylawsConsultationDiagnostics(
                modelIdentifier: summaryGenerator.modelIdentifier,
                retrieval: matches.map {
                    BylawsRetrievalDiagnostic(sourceID: $0.article.id, score: $0.score)
                }
            )
        )
    }

    private func loadIndex() async throws -> BylawsKnowledgeIndex {
        do {
            return try await knowledgeIndexProvider.loadIndex()
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            throw BylawsConsultationError.noEvidence
        }
    }

    private func makeEvidence(
        from matches: [BylawsRetrievedArticle]
    ) -> [BylawsSourceEvidence] {
        matches.map { match in
            BylawsSourceEvidence(
                sourceID: match.article.id,
                articleNumber: match.article.articleNumber,
                title: match.article.title,
                pageStart: match.article.pageStart,
                pageEnd: match.article.pageEnd,
                excerpt: match.excerpt
            )
        }
    }

    private func generateSummary(
        question: String,
        evidence: [BylawsSourceEvidence],
        responseLanguage: BylawsResponseLanguage
    ) async throws -> String {
        do {
            return try await summaryGenerator.summarize(
                BylawsSummaryRequest(
                    question: question,
                    evidence: evidence,
                    responseLanguage: responseLanguage
                )
            )
        } catch is CancellationError {
            throw CancellationError()
        } catch let error as BylawsConsultationError {
            throw error
        } catch {
            throw BylawsConsultationError.generationFailed
        }
    }

    /// Classifies generated text without allowing the model to author source references.
    ///
    /// Explicit insufficient-evidence markers produce `.noEvidence`; empty output, refusal
    /// language, or generated article/page references are invalid. All other normalized output
    /// is accepted for presentation alongside application-owned evidence.
    private func validationResult(for summary: String) -> SummaryValidationResult {
        guard !summary.isEmpty else { return .invalid }

        let normalized = summary.folding(
            options: [.caseInsensitive, .diacriticInsensitive],
            locale: Locale(identifier: "es_ES")
        )
        let noEvidenceMarkers = [
            "no_consta",
            "no consta",
            "no hay informacion suficiente",
            "no tengo suficiente informacion",
            "not enough information",
            "insufficient information"
        ]
        if noEvidenceMarkers.contains(where: normalized.contains) {
            return .noEvidence
        }
        let refusalMarkers = [
            "no puedo responder",
            "no puedo ayudar",
            "no es posible responder",
            "lo siento",
            "cannot answer",
            "can't answer",
            "cannot help",
            "can't help",
            "unable to answer",
            "sorry"
        ]
        guard !refusalMarkers.contains(where: normalized.contains) else {
            return .invalid
        }
        return containsGeneratedReference(normalized) ? .invalid : .valid
    }

    private func containsGeneratedReference(_ normalizedSummary: String) -> Bool {
        let referencePattern = #"\b(?:art(?:iculo(?:s)?|s)?|pag(?:ina(?:s)?|s)?|pp?"#
            + #"|article(?:s)?|page(?:s)?)\b\.?"#
        return normalizedSummary.range(
            of: referencePattern,
            options: .regularExpression
        ) != nil
    }

    private enum SummaryValidationResult {
        case valid
        case noEvidence
        case invalid
    }
}

extension ConsultBylawsUseCase {
    init(
        knowledgeProvider: any BylawsKnowledgeProviding,
        retriever: any BylawsRetrieving,
        questionScopeClassifier: any BylawsQuestionScopeClassifying,
        summaryGenerator: any BylawsSummaryGenerating
    ) {
        self.knowledgeIndexProvider = knowledgeProvider
        self.retriever = retriever
        self.questionScopeClassifier = questionScopeClassifier
        self.summaryGenerator = summaryGenerator
    }
}
