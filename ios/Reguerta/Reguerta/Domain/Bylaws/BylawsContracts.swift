import Foundation

nonisolated protocol BylawsKnowledgeProviding: Sendable {
    func loadIndex() async throws -> BylawsKnowledgeIndex
}

nonisolated protocol BylawsRetrieving: Sendable {
    func retrieve(question: String, in articles: [BylawsArticle], maxResults: Int) -> [BylawsRetrievedArticle]
}

nonisolated protocol BylawsQuestionScopeClassifying: Sendable {
    func classify(question: String) -> BylawsQuestionScope
}

nonisolated protocol BylawsSummaryGenerating: Sendable {
    var modelIdentifier: String { get }

    func capability(for responseLanguage: BylawsResponseLanguage) async -> BylawsConsultationCapability
    func summarize(_ request: BylawsSummaryRequest) async throws -> String
}

nonisolated protocol BylawsConsulting: Sendable {
    func capability(for responseLanguage: BylawsResponseLanguage) async -> BylawsConsultationCapability
    func consult(question: String, responseLanguage: BylawsResponseLanguage) async throws -> BylawsConsultationResult
}

nonisolated protocol BylawsDocumentProviding: Sendable {
    @MainActor func bundledPdfURL() -> URL?
}
