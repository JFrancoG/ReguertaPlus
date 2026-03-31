import Foundation

struct NewsArticle: Identifiable, Equatable, Sendable {
    let id: String
    let title: String
    let body: String
    let active: Bool
    let publishedBy: String
    let publishedAtMillis: Int64
    let urlImage: String?
}
