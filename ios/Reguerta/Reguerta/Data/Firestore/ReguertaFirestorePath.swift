import FirebaseFirestore
import Foundation
import Synchronization

typealias ReguertaFirestoreEnvironment = SessionEnvironment

enum ReguertaRuntimeEnvironment {
    private struct State {
        var sessionOverride: ReguertaFirestoreEnvironment?
        var sessionEnvironmentLease: SessionEnvironmentLease?
        var testingBaseEnvironment: ReguertaFirestoreEnvironment?
    }

    private static let state = Mutex(State())

    static var baseFirestoreEnvironment: ReguertaFirestoreEnvironment {
        state.withLock { state in
            resolvedBaseEnvironment(testingBaseEnvironment: state.testingBaseEnvironment)
        }
    }

    static var currentFirestoreEnvironment: ReguertaFirestoreEnvironment {
        state.withLock { state in
            state.sessionOverride ?? resolvedBaseEnvironment(
                testingBaseEnvironment: state.testingBaseEnvironment
            )
        }
    }

    static func applySessionEnvironment(_ environment: ReguertaFirestoreEnvironment, lease: SessionEnvironmentLease) {
        state.withLock { state in
            let baseEnvironment = resolvedBaseEnvironment(
                testingBaseEnvironment: state.testingBaseEnvironment
            )
            state.sessionOverride = environment == baseEnvironment ? nil : environment
            state.sessionEnvironmentLease = lease
        }
    }

    static func resetToBaseEnvironment(ifOwnedBy lease: SessionEnvironmentLease) {
        state.withLock { state in
            guard state.sessionEnvironmentLease == lease else { return }
            state.sessionOverride = nil
            state.sessionEnvironmentLease = nil
        }
    }

    static func resetToBaseEnvironment() {
        state.withLock { state in
            state.sessionOverride = nil
            state.sessionEnvironmentLease = nil
        }
    }

    static func setBaseEnvironmentForTesting(_ environment: ReguertaFirestoreEnvironment?) {
        state.withLock { state in
            state.testingBaseEnvironment = environment
            state.sessionOverride = nil
            state.sessionEnvironmentLease = nil
        }
    }

    private static func resolvedBaseEnvironment(
        testingBaseEnvironment: ReguertaFirestoreEnvironment?
    ) -> ReguertaFirestoreEnvironment {
        if let testingBaseEnvironment {
            return testingBaseEnvironment
        }
        #if DEBUG
        return .develop
        #else
        return .production
        #endif
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
