import Foundation

protocol NewsRepository: Sendable {
    func news(visibleTo member: Member, environment: SessionEnvironment) async throws -> [NewsArticle]
    func allNews(environment: SessionEnvironment) async throws -> [NewsArticle]
    func upsert(article: NewsArticle, environment: SessionEnvironment) async throws -> NewsArticle
    func delete(newsId: String, environment: SessionEnvironment) async throws -> Bool
}
