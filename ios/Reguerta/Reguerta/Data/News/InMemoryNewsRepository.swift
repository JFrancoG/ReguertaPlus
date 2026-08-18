import Foundation

actor InMemoryNewsRepository: NewsRepository {
    private var articles: [String: NewsArticle]

    init(items: [NewsArticle]? = nil) {
        self.articles = Dictionary(uniqueKeysWithValues: (items ?? Self.seedArticles).map { ($0.id, $0) })
    }

    private static let seedArticles: [NewsArticle] = [
        NewsArticle(
            id: "news_welcome_001",
            title: "seed.news.welcome.title",
            body: "seed.news.welcome.body",
            active: true,
            publishedBy: "Ana Admin",
            publishedAtMillis: 1_711_849_600_000,
            urlImage: nil
        )
    ]

    func news(visibleTo member: Member) async throws -> [NewsArticle] {
        let canPublishNews = await MainActor.run { member.canPublishNews }
        return await allNews().filter { canPublishNews || $0.active }
    }

    func allNews() async -> [NewsArticle] {
        var localized: [NewsArticle] = []
        localized.reserveCapacity(articles.count)
        for article in articles.values {
            localized.append(await localizedSeedNews(article))
        }
        return localized.sorted { $0.publishedAtMillis > $1.publishedAtMillis }
    }

    func upsert(article: NewsArticle) async -> NewsArticle {
        let articleId = article.id.isEmpty ? "news_\(articles.count + 1)" : article.id
        let persisted = NewsArticle(
            id: articleId,
            title: article.title,
            body: article.body,
            active: article.active,
            publishedBy: article.publishedBy,
            publishedAtMillis: article.publishedAtMillis,
            urlImage: article.urlImage
        )
        articles[articleId] = persisted
        return persisted
    }

    func delete(newsId: String) async -> Bool {
        articles.removeValue(forKey: newsId) != nil
    }
}

extension InMemoryNewsRepository {
    static func uiTesting() -> InMemoryNewsRepository {
        InMemoryNewsRepository(
            items: [
                NewsArticle(
                    id: "news_ui_testing_brief",
                    title: "Community garden update",
                    body: "The irrigation review is complete.",
                    active: true,
                    publishedBy: "Ana Admin",
                    publishedAtMillis: 1_711_849_800_000,
                    urlImage: "reguerta-ui-test://news/brief"
                ),
                NewsArticle(
                    id: "news_ui_testing_medium",
                    title: "Saturday work group changes and updated meeting point",
                    // swiftlint:disable:next line_length
                    body: "The next work group will meet at the north gate before walking to the shared plots together.",
                    active: true,
                    publishedBy: "Ana Admin",
                    publishedAtMillis: 1_711_849_700_000,
                    urlImage: "reguerta-ui-test://news/medium"
                ),
                NewsArticle(
                    id: "news_ui_testing_overflow_target",
                    title: "Important cooperative assembly information for members and producer families",
                    // swiftlint:disable:next line_length
                    body: "Please review the agenda, accessibility notes, voting schedule, and arrival instructions before the assembly begins.",
                    active: true,
                    publishedBy: "Ana Admin",
                    publishedAtMillis: 1_711_849_600_000,
                    urlImage: "reguerta-ui-test://news/overflow-target"
                )
            ]
        )
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
