import Foundation

struct NewsArticle: Identifiable, Equatable, Sendable {
    let id: String
    let title: String
    let body: String
    let active: Bool
    let publishedBy: String
    let publishedAtMillis: Int64
    let urlImage: String?

    nonisolated init(
        id: String,
        title: String,
        body: String,
        active: Bool,
        publishedBy: String,
        publishedAtMillis: Int64,
        urlImage: String?
    ) {
        self.id = id
        self.title = title
        self.body = body
        self.active = active
        self.publishedBy = publishedBy
        self.publishedAtMillis = publishedAtMillis
        self.urlImage = urlImage
    }
}
