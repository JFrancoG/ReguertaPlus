import FirebaseFirestore
import Foundation

enum ReguertaFirestoreEnvironment: String, Sendable {
    case develop
    case production
}

enum ReguertaRuntimeEnvironment {
    private static var sessionOverride: ReguertaFirestoreEnvironment?
    private static var testingBaseEnvironment: ReguertaFirestoreEnvironment?

    static var baseFirestoreEnvironment: ReguertaFirestoreEnvironment {
        if let testingBaseEnvironment {
            return testingBaseEnvironment
        }
        #if DEBUG
        return .develop
        #else
        return .production
        #endif
    }

    static var currentFirestoreEnvironment: ReguertaFirestoreEnvironment {
        sessionOverride ?? baseFirestoreEnvironment
    }

    static func applySessionEnvironment(_ environment: ReguertaFirestoreEnvironment) {
        sessionOverride = environment == baseFirestoreEnvironment ? nil : environment
    }

    static func resetToBaseEnvironment() {
        sessionOverride = nil
    }

    static func setBaseEnvironmentForTesting(_ environment: ReguertaFirestoreEnvironment?) {
        testingBaseEnvironment = environment
        resetToBaseEnvironment()
    }
}

enum ReguertaFirestoreCollection: String, Sendable {
    case users
    case products
    case orders
    case orderlines
    case seasonalCommitments
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
    let environment: ReguertaFirestoreEnvironment?

    init(environment: ReguertaFirestoreEnvironment? = nil) {
        self.environment = environment
    }

    var resolvedEnvironment: ReguertaFirestoreEnvironment {
        environment ?? ReguertaRuntimeEnvironment.currentFirestoreEnvironment
    }

    func collectionPath(_ collection: ReguertaFirestoreCollection) -> String {
        "\(resolvedEnvironment.rawValue)/\(collection.pathComponent)"
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
        environment: ReguertaFirestoreEnvironment? = nil
    ) -> CollectionReference {
        self.collection(
            ReguertaFirestorePath(environment: environment).collectionPath(firestoreCollection)
        )
    }

    func reguertaDocument(
        _ firestoreDocument: ReguertaFirestoreDocument,
        in firestoreCollection: ReguertaFirestoreCollection,
        environment: ReguertaFirestoreEnvironment? = nil
    ) -> DocumentReference {
        self.document(
            ReguertaFirestorePath(environment: environment)
                .documentPath(in: firestoreCollection, documentId: firestoreDocument.rawValue)
        )
    }
}
