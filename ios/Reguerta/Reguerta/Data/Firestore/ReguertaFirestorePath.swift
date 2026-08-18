import FirebaseFirestore
import Foundation

typealias ReguertaFirestoreEnvironment = SessionEnvironment

enum ReguertaRuntimeEnvironment {
    private static var sessionOverride: ReguertaFirestoreEnvironment?
    private static var sessionEnvironmentLease: SessionEnvironmentLease?
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

    static func applySessionEnvironment(_ environment: ReguertaFirestoreEnvironment, lease: SessionEnvironmentLease) {
        sessionOverride = environment == baseFirestoreEnvironment ? nil : environment
        sessionEnvironmentLease = lease
    }

    static func resetToBaseEnvironment(ifOwnedBy lease: SessionEnvironmentLease) {
        guard sessionEnvironmentLease == lease else { return }
        resetToBaseEnvironment()
    }

    static func resetToBaseEnvironment() {
        sessionOverride = nil
        sessionEnvironmentLease = nil
    }

    static func setBaseEnvironmentForTesting(_ environment: ReguertaFirestoreEnvironment?) {
        testingBaseEnvironment = environment
        resetToBaseEnvironment()
    }
}

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
    private let storedEnvironment: ReguertaFirestoreEnvironment?

    var environment: ReguertaFirestoreEnvironment? { storedEnvironment }

    var resolvedEnvironment: ReguertaFirestoreEnvironment {
        environment ?? ReguertaRuntimeEnvironment.currentFirestoreEnvironment
    }

    func collectionPath(_ collection: ReguertaFirestoreCollection) -> String {
        "\(resolvedEnvironment.rawValue)/\(collection.pathComponent)"
    }

    func documentPath(in collection: ReguertaFirestoreCollection, documentId: String) -> String {
        "\(collectionPath(collection))/\(documentId)"
    }
}

extension ReguertaFirestorePath {
    init(environment: ReguertaFirestoreEnvironment? = nil) {
        self.storedEnvironment = environment
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
