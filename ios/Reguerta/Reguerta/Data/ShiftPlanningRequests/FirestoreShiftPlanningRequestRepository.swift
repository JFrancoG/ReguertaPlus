import FirebaseFirestore
import Foundation

final class FirestoreShiftPlanningRequestRepository: @unchecked Sendable, ShiftPlanningRequestRepository {
    private let db: Firestore
    private let environment: ReguertaFirestoreEnvironment?

    init(
        db: Firestore = Firestore.firestore(),
        environment: ReguertaFirestoreEnvironment? = nil
    ) {
        self.db = db
        self.environment = environment
    }

    private var requestsCollection: CollectionReference {
        db.reguertaCollection(.shiftPlanningRequests, environment: environment)
    }

    func submit(request: ShiftPlanningRequest) async -> ShiftPlanningRequest {
        let documentId = request.id.isEmpty ? requestsCollection.document().documentID : request.id
        let persisted = ShiftPlanningRequest(
            id: documentId,
            type: request.type,
            requestedByUserId: request.requestedByUserId,
            requestedAtMillis: request.requestedAtMillis,
            status: request.status
        )

        do {
            try await requestsCollection.document(documentId).setData([
                "type": persisted.type.rawValue,
                "requestedByUserId": persisted.requestedByUserId,
                "requestedAt": Timestamp(date: Date(timeIntervalSince1970: TimeInterval(persisted.requestedAtMillis) / 1_000)),
                "status": persisted.status.rawValue,
            ], merge: true)
            return persisted
        } catch {
            return persisted
        }
    }
}
