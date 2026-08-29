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

    func observeLatestV2Request(
        environment: SessionEnvironment
    ) async -> AsyncThrowingStream<ShiftPlanningRequestObservation?, any Error> {
        guard let inspectionExecutor else {
            return AsyncThrowingStream { continuation in continuation.finish() }
        }
        return AsyncThrowingStream { continuation in
            let observationTask = Task { [weak self] in
                while !Task.isCancelled {
                    guard let self else { return }
                    let outcome = await self.latestV2Request(
                        environment: environment,
                        executor: inspectionExecutor
                    )
                    switch outcome {
                    case .success(let request):
                        continuation.yield(request)
                    case .failure(let error):
                        continuation.finish(throwing: error)
                        return
                    }
                    do {
                        try await ContinuousClock().sleep(for: .seconds(2))
                    } catch {
                        return
                    }
                }
            }
            continuation.onTermination = { _ in observationTask.cancel() }
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

    private func latestV2Request(
        environment: SessionEnvironment,
        executor: any ShiftPlanningInspectionExecuting
    ) async -> ShiftPlanningObservationOutcome {
        await withCheckedContinuation { continuation in
            executor.loadLatestV2Request(environment: environment) { outcome in
                continuation.resume(returning: outcome)
            }
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
    func loadLatestV2Request(
        environment: SessionEnvironment,
        handler: @escaping @Sendable (ShiftPlanningObservationOutcome) -> Void
    )

    func loadStagedCandidate(
        reference: ShiftPlanningCandidateReference,
        completion: @escaping @Sendable (ShiftPlanningCandidateOutcome) -> Void
    )
}

private final class FirestoreShiftPlanningInspectionExecutor: ShiftPlanningInspectionExecuting, Sendable {
    private let storedDB: Mutex<Firestore>

    init(firebaseAppName: String) {
        guard let app = FirebaseApp.app(name: firebaseAppName) else {
            preconditionFailure("Firebase app is required for shift planning inspection")
        }
        self.storedDB = Mutex(Firestore.firestore(app: app))
    }

    func loadLatestV2Request(
        environment: SessionEnvironment,
        handler: @escaping @Sendable (ShiftPlanningObservationOutcome) -> Void
    ) {
        let path = ReguertaFirestorePath(environment: environment).collectionPath(.shiftPlanningRequests)
        storedDB.withLock { db in
            db.collection(path)
                .order(by: "requestedAt", descending: true)
                .limit(to: 25)
                .getDocuments { snapshot, error in
                    if let error {
                        handler(.failure(Self.repositoryError(error, resource: "shiftPlanningRequests.read")))
                        return
                    }
                    do {
                        let request = try snapshot?.documents.lazy.compactMap { document in
                            try ShiftPlanningInspectionCodec.observation(
                                documentID: document.documentID,
                                data: document.data()
                            )
                        }.first
                        handler(.success(request))
                    } catch let error as RepositoryError {
                        handler(.failure(error))
                    } catch {
                        handler(.failure(.unknown(resource: "shiftPlanningRequests.read")))
                    }
                }
        }
    }

    func loadStagedCandidate(
        reference: ShiftPlanningCandidateReference,
        completion: @escaping @Sendable (ShiftPlanningCandidateOutcome) -> Void
    ) {
        let path = ReguertaFirestorePath(environment: reference.environment)
            .documentPath(in: .shiftPlanningCandidates, documentId: reference.candidateId)
        storedDB.withLock { db in
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
