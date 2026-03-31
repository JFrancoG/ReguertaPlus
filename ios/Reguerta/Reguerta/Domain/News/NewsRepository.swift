import Foundation

protocol NewsRepository: Sendable {
    func allNews() async -> [NewsArticle]
    func upsert(article: NewsArticle) async -> NewsArticle
    func delete(newsId: String) async -> Bool
}
