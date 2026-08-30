import FirebaseFirestore
import Foundation

typealias ReguertaFirestoreEnvironment = SessionEnvironment

enum ReguertaFirestoreCollection: String, Sendable {
    case users
    case memberDirectory
    case products
    case orders
    case orderlines
    case seasonalCommitments
    case config
    case deliveryCalendar
    case sharedProfiles
    case shifts
    case shiftPlanningRequests
    case shiftPlanningCandidates
    case shiftSwapRequests
    case news
    case notificationEvents

    fileprivate var pathComponent: String {
        "plus-collections/\(rawValue)"
    }
}

enum ReguertaFirestoreDocument: String, Sendable {
    case global
    case memberConfiguration = "member"
    case publicConfiguration = "public"
}

struct ReguertaFirestorePath {
    let environment: ReguertaFirestoreEnvironment

    func collectionPath(_ collection: ReguertaFirestoreCollection) -> String {
        "\(environment.rawValue)/\(collection.pathComponent)"
    }

    func documentPath(in collection: ReguertaFirestoreCollection, documentId: String) -> String {
        "\(collectionPath(collection))/\(documentId)"
    }
}

extension Firestore {
    func reguertaCollection(
        _ firestoreCollection: ReguertaFirestoreCollection,
        environment: ReguertaFirestoreEnvironment
    ) -> CollectionReference {
        self.collection(
            ReguertaFirestorePath(environment: environment).collectionPath(firestoreCollection)
        )
    }

    func reguertaDocument(
        _ firestoreDocument: ReguertaFirestoreDocument,
        in firestoreCollection: ReguertaFirestoreCollection,
        environment: ReguertaFirestoreEnvironment
    ) -> DocumentReference {
        self.document(
            ReguertaFirestorePath(environment: environment)
                .documentPath(in: firestoreCollection, documentId: firestoreDocument.rawValue)
        )
    }
}
