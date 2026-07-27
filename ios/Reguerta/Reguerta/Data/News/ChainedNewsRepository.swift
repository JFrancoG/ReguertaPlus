import Foundation

actor ChainedNewsRepository: NewsRepository {
    private let primary: any NewsRepository
    private let fallback: any NewsRepository

    init(primary: any NewsRepository, fallback: any NewsRepository) {
        self.primary = primary
        self.fallback = fallback
    }

    func news(visibleTo member: Member) async throws -> [NewsArticle] {
        let primaryNews = try await primary.news(visibleTo: member)
        if !primaryNews.isEmpty {
            return primaryNews
        }
        return try await fallback.news(visibleTo: member)
    }

    func allNews() async throws -> [NewsArticle] {
        let primaryNews = try await primary.allNews()
        if !primaryNews.isEmpty {
            return primaryNews
        }
        return try await fallback.allNews()
    }

    func upsert(article: NewsArticle) async throws -> NewsArticle {
        _ = try await fallback.upsert(article: article)
        return try await primary.upsert(article: article)
    }

    func delete(newsId: String) async throws -> Bool {
        let fallbackDeleted = try await fallback.delete(newsId: newsId)
        let primaryDeleted = try await primary.delete(newsId: newsId)
        return primaryDeleted || fallbackDeleted
    }
}
