import FirebaseFirestore
import Foundation

nonisolated enum ShiftPlanningRequestTransactionDecision: Equatable, Sendable {
    case create(ShiftPlanningRequest)
    case acknowledge(ShiftPlanningRequest)
}

final class FirestoreShiftPlanningRequestRepository: @unchecked Sendable, ShiftPlanningRequestRepository {
    private let db: Firestore
    private let environment: ReguertaFirestoreEnvironment?

    init(db: Firestore = Firestore.firestore(), environment: ReguertaFirestoreEnvironment? = nil) {
        self.db = db
        self.environment = environment
    }

    private var requestsCollection: CollectionReference {
        db.reguertaCollection(.shiftPlanningRequests, environment: environment)
    }

    func submit(request: ShiftPlanningRequest) async throws -> ShiftPlanningRequest {
        guard !request.id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw RepositoryError.invalidData(resource: "shiftPlanningRequests.document")
        }

        do {
            let result = try await runCreateIfAbsentTransaction(request: request)
            return try result.resolvedRequest()
        } catch {
            if Task.isCancelled {
                throw CancellationError()
            }
            throw FirestoreRepositoryErrorMapper.map(error, resource: "shiftPlanningRequests.write")
        }
    }

    private func runCreateIfAbsentTransaction(
        request: ShiftPlanningRequest
    ) async throws -> ShiftPlanningRequestTransactionResult {
        let document = requestsCollection.document(request.id)
        return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<ShiftPlanningRequestTransactionResult, any Error>) in
            db.runTransaction { transaction, errorPointer -> Any? in
                Self.transactionValue(
                    transaction: transaction,
                    errorPointer: errorPointer,
                    document: document,
                    requested: request
                )
            } completion: { result, error in
                Self.resumeTransaction(
                    continuation,
                    result: result,
                    error: error
                )
            }
        }
    }

    private static func transactionValue(
        transaction: Transaction,
        errorPointer: NSErrorPointer,
        document: DocumentReference,
        requested: ShiftPlanningRequest
    ) -> Any? {
        let snapshot: DocumentSnapshot
        do {
            snapshot = try transaction.getDocument(document)
        } catch let error as NSError {
            errorPointer?.pointee = error
            return nil
        }

        let decision: ShiftPlanningRequestTransactionDecision
        do {
            decision = try transactionDecision(
                documentID: document.documentID,
                data: snapshot.exists ? snapshot.data() : nil,
                requested: requested
            )
        } catch {
            return ShiftPlanningRequestTransactionResult.invalidData
        }

        switch decision {
        case .create(let requestToCreate):
            transaction.setData(
                firestoreData(for: requestToCreate),
                forDocument: document
            )
            return ShiftPlanningRequestTransactionResult.success(requestToCreate)
        case .acknowledge(let existing):
            return ShiftPlanningRequestTransactionResult.success(existing)
        }
    }

    private static func resumeTransaction(
        _ continuation: CheckedContinuation<ShiftPlanningRequestTransactionResult, any Error>,
        result: Any?,
        error: (any Error)?
    ) {
        if let error {
            continuation.resume(throwing: error)
        } else if let transactionResult = result as? ShiftPlanningRequestTransactionResult {
            continuation.resume(returning: transactionResult)
        } else {
            continuation.resume(
                throwing: RepositoryError.invalidData(
                    resource: "shiftPlanningRequests.transaction"
                )
            )
        }
    }

    static func transactionDecision(
        documentID: String,
        data: [String: Any]?,
        requested: ShiftPlanningRequest
    ) throws -> ShiftPlanningRequestTransactionDecision {
        guard !documentID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              requested.id == documentID,
              !requested.requestedByUserId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              requested.requestedAtMillis >= 0,
              requested.status == .requested else {
            throw RepositoryError.invalidData(resource: "shiftPlanningRequests.document")
        }
        guard let data else { return .create(requested) }

        guard let typeValue = data["type"] as? String,
              let type = ShiftPlanningRequestType(rawValue: typeValue),
              let requestedByUserId = data["requestedByUserId"] as? String,
              !requestedByUserId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              let requestedAt = data["requestedAt"] as? Timestamp,
              let statusValue = data["status"] as? String,
              let status = ShiftPlanningRequestStatus(rawValue: statusValue) else {
            throw RepositoryError.invalidData(resource: "shiftPlanningRequests.document")
        }
        let expectedRequestedAt = timestamp(for: requested.requestedAtMillis)
        guard type == requested.type,
              requestedByUserId == requested.requestedByUserId,
              requestedAt.seconds == expectedRequestedAt.seconds,
              requestedAt.nanoseconds == expectedRequestedAt.nanoseconds else {
            throw RepositoryError.invalidData(resource: "shiftPlanningRequests.document")
        }

        return .acknowledge(
            ShiftPlanningRequest(
                id: documentID,
                type: type,
                requestedByUserId: requestedByUserId,
                requestedAtMillis: requested.requestedAtMillis,
                status: status
            )
        )
    }

    private static func firestoreData(for request: ShiftPlanningRequest) -> [String: Any] {
        [
            "type": request.type.rawValue,
            "requestedByUserId": request.requestedByUserId,
            "requestedAt": timestamp(for: request.requestedAtMillis),
            "status": request.status.rawValue
        ]
    }

    private static func timestamp(for millis: Int64) -> Timestamp {
        Timestamp(
            seconds: millis / 1_000,
            nanoseconds: Int32((millis % 1_000) * 1_000_000)
        )
    }
}

nonisolated private enum ShiftPlanningRequestTransactionResult: Sendable {
    case success(ShiftPlanningRequest)
    case invalidData

    func resolvedRequest() throws -> ShiftPlanningRequest {
        switch self {
        case .success(let request):
            request
        case .invalidData:
            throw RepositoryError.invalidData(resource: "shiftPlanningRequests.document")
        }
    }
}
