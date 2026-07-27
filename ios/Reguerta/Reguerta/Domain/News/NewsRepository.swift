import Foundation

protocol NewsRepository: Sendable {
    func news(visibleTo member: Member) async throws -> [NewsArticle]
    func allNews() async throws -> [NewsArticle]
    func upsert(article: NewsArticle) async throws -> NewsArticle
    func delete(newsId: String) async throws -> Bool
}
