import Foundation

actor InMemoryNewsRepository: NewsRepository {
    private var articles: [String: NewsArticle] = [
        "news_welcome_001": NewsArticle(
            id: "news_welcome_001",
            title: "seed.news.welcome.title",
            body: "seed.news.welcome.body",
            active: true,
            publishedBy: "Ana Admin",
            publishedAtMillis: 1_711_849_600_000,
            urlImage: nil
        )
    ]

    func allNews() async -> [NewsArticle] {
        var localized: [NewsArticle] = []
        localized.reserveCapacity(articles.count)
        for article in articles.values {
            localized.append(await localizedSeedNews(article))
        }
        return localized.sorted { $0.publishedAtMillis > $1.publishedAtMillis }
    }

    func upsert(article: NewsArticle) async -> NewsArticle {
        articles[article.id] = article
        return article
    }

    func delete(newsId: String) async -> Bool {
        articles.removeValue(forKey: newsId) != nil
    }
}

private func localizedSeedNews(_ article: NewsArticle) async -> NewsArticle {
    let title = await MainActor.run {
        NSLocalizedString(article.title, comment: "")
    }
    let body = await MainActor.run {
        NSLocalizedString(article.body, comment: "")
    }
    return NewsArticle(
        id: article.id,
        title: title,
        body: body,
        active: article.active,
        publishedBy: article.publishedBy,
        publishedAtMillis: article.publishedAtMillis,
        urlImage: article.urlImage
    )
}
