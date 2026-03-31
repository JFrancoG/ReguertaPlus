import Foundation

actor ChainedNewsRepository: NewsRepository {
    private let primary: any NewsRepository
    private let fallback: any NewsRepository

    init(primary: any NewsRepository, fallback: any NewsRepository) {
        self.primary = primary
        self.fallback = fallback
    }

    func allNews() async -> [NewsArticle] {
        let primaryNews = await primary.allNews()
        if !primaryNews.isEmpty {
            return primaryNews
        }
        return await fallback.allNews()
    }

    func upsert(article: NewsArticle) async -> NewsArticle {
        _ = await fallback.upsert(article: article)
        return await primary.upsert(article: article)
    }

    func delete(newsId: String) async -> Bool {
        let fallbackDeleted = await fallback.delete(newsId: newsId)
        let primaryDeleted = await primary.delete(newsId: newsId)
        return primaryDeleted || fallbackDeleted
    }
}
