import FirebaseFirestore
import Foundation
import Synchronization
import Testing

@testable import Reguerta

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct FirestoreShiftPlanningRequestRepositoryTests {
    @Test func createsOnlyWhenAbsentAndAcknowledgesCompatibleExistingState() throws {
        let request = planningRequest()

        #expect(
            try FirestoreShiftPlanningRequestRepository.transactionDecision(
                documentID: request.id,
                data: nil,
                requested: request
            ) == .create(request)
        )

        for status in [
            ShiftPlanningRequestStatus.requested,
            .processing,
            .completed,
            .failed
        ] {
            let existing = requestWithStatus(status, basedOn: request)
            #expect(
                try FirestoreShiftPlanningRequestRepository.transactionDecision(
                    documentID: request.id,
                    data: firestoreData(for: existing),
                    requested: request
                ) == .acknowledge(existing)
            )
        }
    }

    @Test func rejectsAnIncompatibleOrMalformedExistingRequest() {
        let request = planningRequest()
        let validData = firestoreData(for: requestWithStatus(.completed, basedOn: request))
        let invalidVariants: [[String: Any]] = [
            validData.merging(["type": "delivery"]) { _, replacement in replacement },
            validData.merging(["requestedByUserId": "admin_2"]) { _, replacement in replacement },
            validData.merging(
                ["requestedAt": Timestamp(seconds: 124, nanoseconds: 0)]
            ) { _, replacement in replacement },
            validData.merging(["status": "unknown"]) { _, replacement in replacement },
            validData.filter { $0.key != "requestedAt" }
        ]

        for data in invalidVariants {
            #expect(throws: RepositoryError.invalidData(resource: "shiftPlanningRequests.document")) {
                try FirestoreShiftPlanningRequestRepository.transactionDecision(
                    documentID: request.id,
                    data: data,
                    requested: request
                )
            }
        }

        for status in [
            ShiftPlanningRequestStatus.processing,
            .completed,
            .failed
        ] {
            let invalidIntent = requestWithStatus(status, basedOn: request)
            #expect(throws: RepositoryError.invalidData(resource: "shiftPlanningRequests.document")) {
                try FirestoreShiftPlanningRequestRepository.transactionDecision(
                    documentID: invalidIntent.id,
                    data: nil,
                    requested: invalidIntent
                )
            }
        }

        let blankIdentifier = ShiftPlanningRequest(
            id: " ",
            type: request.type,
            requestedByUserId: request.requestedByUserId,
            requestedAtMillis: request.requestedAtMillis,
            status: .requested
        )
        #expect(throws: RepositoryError.invalidData(resource: "shiftPlanningRequests.document")) {
            try FirestoreShiftPlanningRequestRepository.transactionDecision(
                documentID: blankIdentifier.id,
                data: nil,
                requested: blankIdentifier
            )
        }
    }

    @Test func usesAnOnlineCreateIfAbsentTransaction() throws {
        let sourceURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appending(path: "Reguerta/Data/ShiftPlanningRequests/FirestoreShiftPlanningRequestRepository.swift")
        let source = try String(contentsOf: sourceURL, encoding: .utf8)

        #expect(source.contains("storedDB.runTransaction"))
        #expect(source.contains("transaction.getDocument"))
        #expect(source.contains("transaction.setData"))
        #expect(source.contains("let updateBlock: @Sendable"))
        #expect(source.contains("let completionBlock: @Sendable"))
        #expect(source.contains("Mutex<Firestore>"))
        #expect(source.contains("Mutex<DocumentReference>"))
        #expect(source.contains("@unchecked Sendable") == false)
        #expect(source.contains("@preconcurrency") == false)
        #expect(source.contains("environmentProvider") == false)
        #expect(source.contains("merge: true") == false)
        #expect(source.contains("document().documentID") == false)
    }

    @Test func cancellationAfterTransactionCompletionCannotPublishSuccess() async throws {
        let request = planningRequest()
        let executor = ControlledShiftPlanningTransactionExecutor()
        let repository = FirestoreShiftPlanningRequestRepository(transactionExecutor: executor)
        let operation = Task {
            try await repository.submit(request: request, environment: .develop)
        }
        defer {
            operation.cancel()
            executor.cancelPendingExecution()
        }

        try await executor.waitUntilStarted()
        operation.cancel()
        executor.complete(with: .success(request))

        await #expect(throws: CancellationError.self) {
            try await operation.value
        }
    }

    private func planningRequest() -> ShiftPlanningRequest {
        ShiftPlanningRequest(
            id: "planning_1",
            type: .market,
            requestedByUserId: "admin_1",
            requestedAtMillis: 123_456,
            status: .requested
        )
    }

    private func requestWithStatus(
        _ status: ShiftPlanningRequestStatus,
        basedOn request: ShiftPlanningRequest
    ) -> ShiftPlanningRequest {
        ShiftPlanningRequest(
            id: request.id,
            type: request.type,
            requestedByUserId: request.requestedByUserId,
            requestedAtMillis: request.requestedAtMillis,
            status: status
        )
    }

    private func firestoreData(for request: ShiftPlanningRequest) -> [String: Any] {
        [
            "type": request.type.rawValue,
            "requestedByUserId": request.requestedByUserId,
            "requestedAt": Timestamp(
                seconds: request.requestedAtMillis / 1_000,
                nanoseconds: Int32((request.requestedAtMillis % 1_000) * 1_000_000)
            ),
            "status": request.status.rawValue
        ]
    }
}

private final class ControlledShiftPlanningTransactionExecutor:
    ShiftPlanningRequestTransactionExecuting,
    Sendable {
    private struct State {
        var completion: (@Sendable (ShiftPlanningRequestTransactionOutcome) -> Void)?
        var startedWaiters: [UUID: CheckedContinuation<Void, any Error>] = [:]
    }

    private let state = Mutex(State())

    func execute(
        request: ShiftPlanningRequest,
        environment: SessionEnvironment,
        completion: @escaping @Sendable (ShiftPlanningRequestTransactionOutcome) -> Void
    ) {
        let waiters = state.withLock { state in
            state.completion = completion
            let waiters = Array(state.startedWaiters.values)
            state.startedWaiters.removeAll()
            return waiters
        }
        waiters.forEach { $0.resume() }
    }

    func waitUntilStarted() async throws {
        try Task.checkCancellation()
        guard state.withLock({ $0.completion == nil }) else { return }
        let waiterID = UUID()

        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                let shouldResume = state.withLock { state in
                    guard state.completion == nil, !Task.isCancelled else { return true }
                    state.startedWaiters[waiterID] = continuation
                    return false
                }
                if shouldResume {
                    if Task.isCancelled {
                        continuation.resume(throwing: CancellationError())
                    } else {
                        continuation.resume()
                    }
                }
            }
        } onCancel: {
            let continuation = state.withLock { $0.startedWaiters.removeValue(forKey: waiterID) }
            continuation?.resume(throwing: CancellationError())
        }
    }

    func complete(with outcome: ShiftPlanningRequestTransactionOutcome) {
        let completion = state.withLock { state in
            let completion = state.completion
            state.completion = nil
            return completion
        }
        completion?(outcome)
    }

    func cancelPendingExecution() {
        let pending = state.withLock { state in
            let completion = state.completion
            let waiters = Array(state.startedWaiters.values)
            state.completion = nil
            state.startedWaiters.removeAll()
            return (completion, waiters)
        }
        pending.0?(.cancelled)
        pending.1.forEach { $0.resume(throwing: CancellationError()) }
    }
}
