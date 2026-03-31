import Foundation

actor InMemoryNewsRepository: NewsRepository {
    private var articles: [String: NewsArticle] = [
        "news_welcome_001": NewsArticle(
            id: "news_welcome_001",
            title: "Bienvenida a La Reguerta",
            body: "Este espacio ya esta preparado para compartir avisos semanales y novedades de la comunidad.",
            active: true,
            publishedBy: "Ana Admin",
            publishedAtMillis: 1_711_849_600_000,
            urlImage: nil
        )
    ]

    func allNews() async -> [NewsArticle] {
        articles.values.sorted { $0.publishedAtMillis > $1.publishedAtMillis }
    }

    func upsert(article: NewsArticle) async -> NewsArticle {
        articles[article.id] = article
        return article
    }

    func delete(newsId: String) async -> Bool {
        articles.removeValue(forKey: newsId) != nil
    }
}
