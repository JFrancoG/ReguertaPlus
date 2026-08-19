import CoreFoundation
import FirebaseCore
import FirebaseFirestore
import Foundation

actor FirestoreNewsRepository: NewsRepository {
    private let storedDB: Firestore

    init(firebaseAppName: String) {
        guard let app = FirebaseApp.app(name: firebaseAppName) else {
            preconditionFailure("Firebase app is required for news")
        }
        self.storedDB = Firestore.firestore(app: app)
    }

    func news(visibleTo member: Member, environment: SessionEnvironment) async throws -> [NewsArticle] {
        let newsCollection = storedDB.reguertaCollection(.news, environment: environment)
        let query = member.canPublishNews
            ? newsCollection
            : newsCollection.whereField("active", isEqualTo: true)
        do {
            try Task.checkCancellation()
            let snapshot = try await query.getDocuments()
            return try Self.newsArticles(
                documents: snapshot.documents.map {
                    (documentID: $0.documentID, data: $0.data())
                }
            )
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: "news")
        }
    }

    func allNews(environment: SessionEnvironment) async throws -> [NewsArticle] {
        let newsCollection = storedDB.reguertaCollection(.news, environment: environment)
        do {
            try Task.checkCancellation()
            let snapshot = try await newsCollection.getDocuments()
            return try Self.newsArticles(
                documents: snapshot.documents.map {
                    (documentID: $0.documentID, data: $0.data())
                }
            )
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: "news")
        }
    }

    func upsert(article: NewsArticle, environment: SessionEnvironment) async throws -> NewsArticle {
        let newsCollection = storedDB.reguertaCollection(.news, environment: environment)
        let documentId = article.id.isEmpty ? newsCollection.document().documentID : article.id
        let persisted = NewsArticle(
            id: documentId,
            title: article.title,
            body: article.body,
            active: article.active,
            publishedBy: article.publishedBy,
            publishedAtMillis: article.publishedAtMillis,
            urlImage: article.urlImage
        )

        do {
            try Task.checkCancellation()
            try await newsCollection.document(documentId).setData([
                "title": persisted.title,
                "body": persisted.body,
                "active": persisted.active,
                "publishedBy": persisted.publishedBy,
                "publishedAt": Timestamp(
                    date: Date(timeIntervalSince1970: TimeInterval(persisted.publishedAtMillis) / 1_000)
                ),
                "urlImage": persisted.urlImage as Any
            ], merge: true)
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: "news/\(documentId)")
        }
        return persisted
    }

    func delete(newsId: String, environment: SessionEnvironment) async throws -> Bool {
        let newsCollection = storedDB.reguertaCollection(.news, environment: environment)
        do {
            try Task.checkCancellation()
            try await newsCollection.document(newsId).delete()
            return true
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: "news/\(newsId)")
        }
    }

    static func newsArticles(
        documents: [(documentID: String, data: [String: Any])]
    ) throws -> [NewsArticle] {
        try documents
            .map { try newsArticle(documentID: $0.documentID, data: $0.data) }
            .sorted { $0.publishedAtMillis > $1.publishedAtMillis }
    }

    static func newsArticle(documentID: String, data: [String: Any]) throws -> NewsArticle {
        let dto = try FirestoreNewsDocumentDecoder.decode(documentID: documentID, data: data)
        return FirestoreNewsDocumentMapper.toDomain(dto)
    }
}

private struct FirestoreNewsDocumentDTO {
    let documentID: String
    let title: String
    let body: String
    let publishedBy: String
    let publishedAtMillis: Int64
    let active: Bool
    let imageURL: String?
}

private enum FirestoreNewsDocumentDecoder {
    static func decode(documentID: String, data: [String: Any]) throws -> FirestoreNewsDocumentDTO {
        let normalizedDocumentID = documentID.trimmingCharacters(in: .whitespacesAndNewlines)
        let resource = "news/\(documentID)"
        guard !documentID.isEmpty, documentID == normalizedDocumentID else {
            throw RepositoryError.invalidData(resource: resource)
        }

        return try FirestoreNewsDocumentDTO(
            documentID: documentID,
            title: requiredString(data, field: "title", resource: resource),
            body: requiredString(data, field: "body", resource: resource),
            publishedBy: requiredString(data, field: "publishedBy", resource: resource),
            publishedAtMillis: requiredTimestampMillis(data, field: "publishedAt", resource: resource),
            active: requiredBool(data, field: "active", resource: resource),
            imageURL: optionalString(data, field: "urlImage", resource: resource)
        )
    }

    private static func requiredString(_ data: [String: Any], field: String, resource: String) throws -> String {
        guard let value = try optionalString(data, field: field, resource: resource) else {
            throw RepositoryError.invalidData(resource: resource)
        }
        return value
    }

    private static func optionalString(_ data: [String: Any], field: String, resource: String) throws -> String? {
        guard let value = data[field] else { return nil }
        if value is NSNull { return nil }
        guard let string = value as? String else { throw RepositoryError.invalidData(resource: resource) }
        let normalized = string.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { throw RepositoryError.invalidData(resource: resource) }
        return normalized
    }

    private static func requiredBool(_ data: [String: Any], field: String, resource: String) throws -> Bool {
        guard let number = data[field] as? NSNumber,
              CFGetTypeID(number) == CFBooleanGetTypeID() else {
            throw RepositoryError.invalidData(resource: resource)
        }
        return number.boolValue
    }

    private static func requiredTimestampMillis(
        _ data: [String: Any],
        field: String,
        resource: String
    ) throws -> Int64 {
        guard let timestamp = data[field] as? Timestamp else { throw RepositoryError.invalidData(resource: resource) }
        return Int64(timestamp.dateValue().timeIntervalSince1970 * 1_000)
    }
}

private enum FirestoreNewsDocumentMapper {
    static func toDomain(_ dto: FirestoreNewsDocumentDTO) -> NewsArticle {
        NewsArticle(
            id: dto.documentID,
            title: dto.title,
            body: dto.body,
            active: dto.active,
            publishedBy: dto.publishedBy,
            publishedAtMillis: dto.publishedAtMillis,
            urlImage: dto.imageURL
        )
    }
}
