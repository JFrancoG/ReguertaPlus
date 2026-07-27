import FirebaseFirestore
import Foundation

final class FirestoreNewsRepository: @unchecked Sendable, NewsRepository {
    private let db: Firestore
    private let environment: ReguertaFirestoreEnvironment?

    init(
        db: Firestore = Firestore.firestore(),
        environment: ReguertaFirestoreEnvironment? = nil
    ) {
        self.db = db
        self.environment = environment
    }

    private var newsCollection: CollectionReference {
        db.reguertaCollection(.news, environment: environment)
    }

    func news(visibleTo member: Member) async throws -> [NewsArticle] {
        let query = member.canPublishNews
            ? newsCollection
            : newsCollection.whereField("active", isEqualTo: true)
        let snapshot = try await query.getDocuments()
        return snapshot.documents
            .compactMap(Self.toNewsArticle)
            .sorted { $0.publishedAtMillis > $1.publishedAtMillis }
    }

    func allNews() async throws -> [NewsArticle] {
        let snapshot = try await newsCollection.getDocuments()
        return snapshot.documents
            .compactMap(Self.toNewsArticle)
            .sorted { $0.publishedAtMillis > $1.publishedAtMillis }
    }

    func upsert(article: NewsArticle) async throws -> NewsArticle {
        let documentId = article.id.isEmpty ? newsCollection.document().documentID : article.id
        let persisted = NewsArticle(
            id: documentId,
            title: article.title,
            body: article.body,
            active: article.active,
            publishedBy: article.publishedBy,
            publishedByUserId: article.publishedByUserId,
            publishedAtMillis: article.publishedAtMillis,
            urlImage: article.urlImage
        )

        try await newsCollection.document(documentId).setData([
            "title": persisted.title,
            "body": persisted.body,
            "active": persisted.active,
            "publishedBy": persisted.publishedBy,
            "publishedByUserId": persisted.publishedByUserId as Any,
            "publishedAt": Timestamp(date: Date(timeIntervalSince1970: TimeInterval(persisted.publishedAtMillis) / 1_000)),
            "urlImage": persisted.urlImage as Any
        ], merge: true)
        return persisted
    }

    func delete(newsId: String) async throws -> Bool {
        try await newsCollection.document(newsId).delete()
        return true
    }

    private static func toNewsArticle(_ document: QueryDocumentSnapshot) -> NewsArticle? {
        let data = document.data()
        guard let title = (data["title"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
              let body = (data["body"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
              !title.isEmpty,
              !body.isEmpty else {
            return nil
        }

        let publishedBy = ((data["publishedBy"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines))
            .flatMap { $0.isEmpty ? nil : $0 } ?? "La Reguerta"
        let publishedByUserId = (data["publishedByUserId"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .nilIfEmpty
        let active = (data["active"] as? Bool) ?? true
        let publishedAtMillis: Int64
        if let timestamp = data["publishedAt"] as? Timestamp {
            publishedAtMillis = Int64(timestamp.dateValue().timeIntervalSince1970 * 1_000)
        } else {
            publishedAtMillis = 0
        }
        let urlImage = (data["urlImage"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .nilIfEmpty

        return NewsArticle(
            id: document.documentID,
            title: title,
            body: body,
            active: active,
            publishedBy: publishedBy,
            publishedByUserId: publishedByUserId,
            publishedAtMillis: publishedAtMillis,
            urlImage: urlImage
        )
    }
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}
