import Foundation

nonisolated struct BylawsKnowledgeIndex: Equatable, Sendable {
    let schemaVersion: Int
    let pageCount: Int
    let articles: [BylawsArticle]
}

nonisolated struct BylawsArticle: Identifiable, Equatable, Sendable {
    let id: String
    let kind: String
    let articleNumber: Int?
    let pageStart: Int
    let pageEnd: Int
    let title: String
    let text: String
    let searchAliases: [String]
}

nonisolated struct BylawsRetrievedArticle: Equatable, Sendable {
    let article: BylawsArticle
    let score: Double
    let excerpt: String
}

nonisolated struct BylawsSourceEvidence: Identifiable, Equatable, Sendable {
    let sourceID: String
    let articleNumber: Int?
    let title: String
    let pageStart: Int
    let pageEnd: Int
    let excerpt: String

    nonisolated var id: String { sourceID }
}

nonisolated struct BylawsRetrievalDiagnostic: Equatable, Sendable {
    let sourceID: String
    let score: Double
}

nonisolated struct BylawsConsultationDiagnostics: Equatable, Sendable {
    let modelIdentifier: String
    let retrieval: [BylawsRetrievalDiagnostic]
}

nonisolated struct BylawsConsultationResult: Equatable, Sendable {
    let summary: String
    let evidence: [BylawsSourceEvidence]
    let diagnostics: BylawsConsultationDiagnostics
}

nonisolated enum BylawsResponseLanguage: Equatable, Sendable {
    case spanish
    case english
}

nonisolated struct BylawsSummaryRequest: Equatable, Sendable {
    let question: String
    let evidence: [BylawsSourceEvidence]
    let responseLanguage: BylawsResponseLanguage
}

nonisolated enum BylawsQuestionScope: Equatable, Sendable {
    case potentiallyRelated
    case clearlyUnrelated
}

nonisolated enum BylawsConsultationCapability: Equatable, Sendable {
    case localModel
    case pdfOnly
}

nonisolated enum BylawsConsultationError: Error, Equatable, Sendable {
    case modelUnavailable
    case unrelatedQuestion
    case noEvidence
    case generationFailed
}
