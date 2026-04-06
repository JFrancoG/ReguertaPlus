import FirebaseFirestore
import Foundation

enum ReguertaFirestoreEnvironment: String, Sendable {
    case develop
    case production
}

enum ReguertaFirestoreCollection: String, Sendable {
    case users
    case config
    case deliveryCalendar
    case sharedProfiles
    case shifts
    case shiftPlanningRequests
    case shiftSwapRequests
    case news
    case notificationEvents

    fileprivate var pathComponent: String {
        "plus-collections/\(rawValue)"
    }
}

enum ReguertaFirestoreDocument: String, Sendable {
    case global
}

struct ReguertaFirestorePath: Sendable {
    let environment: ReguertaFirestoreEnvironment

    init(environment: ReguertaFirestoreEnvironment = .develop) {
        self.environment = environment
    }

    func collectionPath(_ collection: ReguertaFirestoreCollection) -> String {
        "\(environment.rawValue)/\(collection.pathComponent)"
    }

    func documentPath(
        in collection: ReguertaFirestoreCollection,
        documentId: String
    ) -> String {
        "\(collectionPath(collection))/\(documentId)"
    }
}

extension Firestore {
    func reguertaCollection(
        _ firestoreCollection: ReguertaFirestoreCollection,
        environment: ReguertaFirestoreEnvironment = .develop
    ) -> CollectionReference {
        self.collection(
            ReguertaFirestorePath(environment: environment).collectionPath(firestoreCollection)
        )
    }

    func reguertaDocument(
        _ firestoreDocument: ReguertaFirestoreDocument,
        in firestoreCollection: ReguertaFirestoreCollection,
        environment: ReguertaFirestoreEnvironment = .develop
    ) -> DocumentReference {
        self.document(
            ReguertaFirestorePath(environment: environment)
                .documentPath(in: firestoreCollection, documentId: firestoreDocument.rawValue)
        )
    }
}
