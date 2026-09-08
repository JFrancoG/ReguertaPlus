import FirebaseCore
import FirebaseFirestore
import Foundation
import Synchronization

enum ShiftPlanningRequestTransactionDecision: Equatable {
    case create(ResolvedShiftPlanningRequest)
    case acknowledge(ShiftPlanningRequest)
}

struct ShiftPlanningRequestContext: Equatable {
    let environment: SessionEnvironment
    let expectedWriteEpoch: Int64
    let expectedActiveRevision: String?
}

struct ResolvedShiftPlanningRequest: Equatable {
    let request: ShiftPlanningRequest
    let context: ShiftPlanningRequestContext
}

enum ShiftPlanningRequestTransactionOutcome {
    case success(ShiftPlanningRequest)
    case failure(RepositoryError)
    case cancelled
}

protocol ShiftPlanningRequestTransactionExecuting: Sendable {
    func execute(
        request: ResolvedShiftPlanningRequest,
        completion: @escaping @Sendable (ShiftPlanningRequestTransactionOutcome) -> Void
    )
}

actor FirestoreShiftPlanningRequestRepository: ShiftPlanningRequestRepository {
    private let transactionExecutor: any ShiftPlanningRequestTransactionExecuting
    private let inspectionExecutor: (any ShiftPlanningInspectionExecuting)?
    private let contextResolver: @Sendable (SessionEnvironment) async throws -> ShiftPlanningRequestContext

    init(firebaseAppName: String, functionsClient: AuthenticatedFirebaseFunctionsClient) {
        self.transactionExecutor = FirestoreShiftPlanningRequestTransactionExecutor(firebaseAppName: firebaseAppName)
        self.inspectionExecutor = FirestoreShiftPlanningInspectionExecutor(firebaseAppName: firebaseAppName)
        let resolver = FirebaseShiftPlanningRequestContextResolver(functionsClient: functionsClient)
        self.contextResolver = { environment in
            try await resolver.resolve(environment: environment)
        }
    }

    init(
        transactionExecutor: any ShiftPlanningRequestTransactionExecuting,
        contextResolver: @escaping @Sendable (SessionEnvironment) async throws -> ShiftPlanningRequestContext = {
            ShiftPlanningRequestContext(
                environment: $0,
                expectedWriteEpoch: 7,
                expectedActiveRevision: "active-6"
            )
        }
    ) {
        self.transactionExecutor = transactionExecutor
        self.inspectionExecutor = nil
        self.contextResolver = contextResolver
    }

    func submit(request: ShiftPlanningRequest, environment: SessionEnvironment) async throws -> ShiftPlanningRequest {
        try Task.checkCancellation()
        let context = try await contextResolver(environment)
        let resolved = try Self.resolve(request: request, context: context)
        let transactionExecutor = transactionExecutor
        let outcome = await withCheckedContinuation { continuation in
            transactionExecutor.execute(request: resolved) { outcome in
                continuation.resume(returning: outcome)
            }
        }
        try Task.checkCancellation()

        switch outcome {
        case .success(let persistedRequest):
            return persistedRequest
        case .failure(let error):
            throw error
        case .cancelled:
            throw CancellationError()
        }
    }

    func observeV2Request(
        environment: SessionEnvironment,
        requestedByUserID: String,
        requestID: String?
    ) async -> AsyncThrowingStream<ShiftPlanningRequestObservation?, any Error> {
        guard let inspectionExecutor else {
            return AsyncThrowingStream { continuation in continuation.finish() }
        }
        return AsyncThrowingStream { continuation in
            let cancel = inspectionExecutor.observeV2Request(
                environment: environment,
                requestedByUserID: requestedByUserID,
                requestID: requestID
            ) { outcome in
                switch outcome {
                case .success(let request):
                    continuation.yield(request)
                case .failure(let error):
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in
                cancel()
            }
        }
    }

    func stagedCandidate(reference: ShiftPlanningCandidateReference) async throws -> ShiftPlanningCandidate {
        guard let inspectionExecutor else {
            throw RepositoryError.invalidData(resource: "shiftPlanningCandidates.unavailable")
        }
        try Task.checkCancellation()
        let outcome = await withCheckedContinuation { continuation in
            inspectionExecutor.loadStagedCandidate(reference: reference) { outcome in
                continuation.resume(returning: outcome)
            }
        }
        try Task.checkCancellation()
        switch outcome {
        case .success(let candidate):
            return candidate
        case .failure(let error):
            throw error
        }
    }

    static func transactionDecision(
        documentID: String,
        data: [String: Any]?,
        requested: ResolvedShiftPlanningRequest
    ) throws -> ShiftPlanningRequestTransactionDecision {
        try ShiftPlanningRequestTransactionCodec.transactionDecision(
            documentID: documentID,
            data: data,
            requested: requested
        )
    }

    static func resolve(
        request: ShiftPlanningRequest,
        context: ShiftPlanningRequestContext
    ) throws -> ResolvedShiftPlanningRequest {
        try ShiftPlanningRequestTransactionCodec.resolve(request: request, context: context)
    }

    static func firestoreData(for request: ResolvedShiftPlanningRequest) -> [String: Any] {
        ShiftPlanningRequestTransactionCodec.firestoreData(for: request)
    }

}

private enum ShiftPlanningObservationOutcome {
    case success(ShiftPlanningRequestObservation?)
    case failure(RepositoryError)
}

private enum ShiftPlanningCandidateOutcome {
    case success(ShiftPlanningCandidate)
    case failure(RepositoryError)
}

private protocol ShiftPlanningInspectionExecuting: Sendable {
    func observeV2Request(
        environment: SessionEnvironment,
        requestedByUserID: String,
        requestID: String?,
        handler: @escaping @Sendable (ShiftPlanningObservationOutcome) -> Void
    ) -> @Sendable () -> Void

    func loadStagedCandidate(
        reference: ShiftPlanningCandidateReference,
        completion: @escaping @Sendable (ShiftPlanningCandidateOutcome) -> Void
    )
}

private final class FirestoreShiftPlanningInspectionExecutor: ShiftPlanningInspectionExecuting, Sendable {
    private let storedState: Mutex<InspectionState>

    private struct InspectionState {
        let db: Firestore
        var listeners: [UUID: any ListenerRegistration] = [:]
    }

    init(firebaseAppName: String) {
        guard let app = FirebaseApp.app(name: firebaseAppName) else {
            preconditionFailure("Firebase app is required for shift planning inspection")
        }
        self.storedState = Mutex(InspectionState(db: Firestore.firestore(app: app)))
    }

    func observeV2Request(
        environment: SessionEnvironment,
        requestedByUserID: String,
        requestID: String?,
        handler: @escaping @Sendable (ShiftPlanningObservationOutcome) -> Void
    ) -> @Sendable () -> Void {
        let path = ReguertaFirestorePath(environment: environment).collectionPath(.shiftPlanningRequests)
        let observationID = UUID()
        storedState.withLock { state in
            let db = state.db
            let collection = db.collection(path)
            let listener: any ListenerRegistration
            if let requestID {
                listener = collection.document(requestID).addSnapshotListener { snapshot, error in
                    Self.deliverObservation(
                        snapshot,
                        error: error,
                        requestedByUserID: requestedByUserID,
                        environment: environment,
                        handler: handler
                    )
                }
            } else {
                listener = collection
                    .whereField("requestedByUserId", isEqualTo: requestedByUserID)
                    .whereField("schemaVersion", isEqualTo: 2)
                    .order(by: "requestedAt", descending: true)
                    .limit(to: 1)
                    .addSnapshotListener { snapshot, error in
                        Self.deliverObservation(
                            snapshot?.documents.first,
                            error: error,
                            requestedByUserID: requestedByUserID,
                            environment: environment,
                            handler: handler
                        )
                    }
            }
            state.listeners[observationID] = listener
        }
        return { [self] in
            storedState.withLock { state in
                state.listeners.removeValue(forKey: observationID)?.remove()
            }
        }
    }

    private static func deliverObservation(
        _ snapshot: DocumentSnapshot?,
        error: (any Error)?,
        requestedByUserID: String,
        environment: SessionEnvironment,
        handler: @escaping @Sendable (ShiftPlanningObservationOutcome) -> Void
    ) {
        if let error {
            handler(.failure(repositoryError(error, resource: "shiftPlanningRequests.read")))
            return
        }
        guard let snapshot, snapshot.exists, let data = snapshot.data() else {
            handler(.success(nil))
            return
        }
        do {
            guard let observation = try ShiftPlanningInspectionCodec.observation(
                documentID: snapshot.documentID,
                data: data,
                expectedEnvironment: environment
            ), observation.requestedByUserId == requestedByUserID else {
                throw RepositoryError.invalidData(resource: "shiftPlanningRequests.observationOwner")
            }
            handler(.success(observation))
        } catch let error as RepositoryError {
            handler(.failure(error))
        } catch {
            handler(.failure(.unknown(resource: "shiftPlanningRequests.read")))
        }
    }

    func loadStagedCandidate(
        reference: ShiftPlanningCandidateReference,
        completion: @escaping @Sendable (ShiftPlanningCandidateOutcome) -> Void
    ) {
        let path = ReguertaFirestorePath(environment: reference.environment)
            .documentPath(in: .shiftPlanningCandidates, documentId: reference.candidateId)
        storedState.withLock { state in
            let db = state.db
            let document = db.document(path)
            document.getDocument { snapshot, error in
                if let error {
                    completion(.failure(Self.repositoryError(error, resource: "shiftPlanningCandidates.read")))
                    return
                }
                guard let snapshot, snapshot.exists, let data = snapshot.data() else {
                    completion(.failure(.invalidData(resource: "shiftPlanningCandidates.document")))
                    return
                }
                let storedHeader = Mutex((documentID: snapshot.documentID, data: data))
                document.collection("positions").getDocuments { positions, error in
                    if let error {
                        completion(.failure(Self.repositoryError(error, resource: "shiftPlanningCandidates.positions")))
                        return
                    }
                    do {
                        let candidate = try storedHeader.withLock { header in
                            try ShiftPlanningInspectionCodec.candidate(
                                documentID: header.documentID,
                                data: header.data,
                                positionDocuments: positions?.documents.map { ($0.documentID, $0.data()) } ?? [],
                                reference: reference
                            )
                        }
                        completion(.success(candidate))
                    } catch let error as RepositoryError {
                        completion(.failure(error))
                    } catch {
                        completion(.failure(.unknown(resource: "shiftPlanningCandidates.read")))
                    }
                }
            }
        }
    }

    private static func repositoryError(_ error: any Error, resource: String) -> RepositoryError {
        FirestoreRepositoryErrorMapper.map(error, resource: resource) as? RepositoryError ??
            .unknown(resource: resource)
    }
}

private final class FirestoreShiftPlanningRequestTransactionExecutor:
    ShiftPlanningRequestTransactionExecuting,
    Sendable {
    private let storedDB: Mutex<Firestore>

    init(firebaseAppName: String) {
        guard let app = FirebaseApp.app(name: firebaseAppName) else {
            preconditionFailure("Firebase app is required for shift planning requests")
        }
        self.storedDB = Mutex(Firestore.firestore(app: app))
    }

    func execute(
        request: ResolvedShiftPlanningRequest,
        completion: @escaping @Sendable (ShiftPlanningRequestTransactionOutcome) -> Void
    ) {
        let documentPath = ReguertaFirestorePath(environment: request.context.environment)
            .documentPath(in: .shiftPlanningRequests, documentId: request.request.id)
        let context = storedDB.withLock { storedDB in
            FirestoreShiftPlanningRequestTransactionContext(
                document: storedDB.document(documentPath),
                requested: request
            )
        }
        let updateBlock: @Sendable (Transaction, NSErrorPointer) -> Any? = { transaction, errorPointer in
            context.transactionValue(transaction: transaction, errorPointer: errorPointer)
        }
        let completionBlock: @Sendable (Any?, (any Error)?) -> Void = { result, error in
            completion(Self.outcome(result: result, error: error))
        }

        storedDB.withLock { storedDB in
            storedDB.runTransaction(updateBlock, completion: completionBlock)
        }
    }

    private static func outcome(result: Any?, error: (any Error)?) -> ShiftPlanningRequestTransactionOutcome {
        if let error {
            let mappedError = FirestoreRepositoryErrorMapper.map(
                error,
                resource: "shiftPlanningRequests.write"
            )
            if mappedError is CancellationError {
                return .cancelled
            }
            return .failure(
                mappedError as? RepositoryError ?? .unknown(resource: "shiftPlanningRequests.write")
            )
        }
        guard let transactionResult = result as? ShiftPlanningRequestTransactionResult else {
            return .failure(.invalidData(resource: "shiftPlanningRequests.transaction"))
        }
        do {
            return .success(try transactionResult.resolvedRequest())
        } catch let error as RepositoryError {
            return .failure(error)
        } catch {
            return .failure(.unknown(resource: "shiftPlanningRequests.transaction"))
        }
    }
}

private final class FirestoreShiftPlanningRequestTransactionContext: Sendable {
    private let document: Mutex<DocumentReference>
    private let requested: ResolvedShiftPlanningRequest

    init(document: DocumentReference, requested: ResolvedShiftPlanningRequest) {
        self.document = Mutex(document)
        self.requested = requested
    }

    func transactionValue(transaction: Transaction, errorPointer: NSErrorPointer) -> Any? {
        document.withLock { document in
            let snapshot: DocumentSnapshot
            do {
                snapshot = try transaction.getDocument(document)
            } catch let error as NSError {
                errorPointer?.pointee = error
                return nil
            }

            let decision: ShiftPlanningRequestTransactionDecision
            do {
                decision = try ShiftPlanningRequestTransactionCodec.transactionDecision(
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
                    ShiftPlanningRequestTransactionCodec.firestoreData(for: requestToCreate),
                    forDocument: document
                )
                return ShiftPlanningRequestTransactionResult.success(requestToCreate.request)
            case .acknowledge(let existing):
                return ShiftPlanningRequestTransactionResult.success(existing)
            }
        }
    }
}

private enum ShiftPlanningRequestTransactionResult {
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
