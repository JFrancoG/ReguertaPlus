import Synchronization

@testable import Reguerta

enum ControlledShiftSwapMutationKind: CaseIterable, Equatable {
    case create
    case respond
    case cancel
    case apply
}

struct ControlledShiftSwapMutationRecord: Equatable {
    let kind: ControlledShiftSwapMutationKind
    let environment: SessionEnvironment
    let requestId: String?
    let candidateShiftId: String?
    let response: ShiftSwapResponseStatus?
}

enum ControlledShiftSwapMutationOutcome {
    case success(ShiftSwapTransitionResult)
    case failure(ShiftSwapCommandError)

    func value() throws -> ShiftSwapTransitionResult {
        switch self {
        case .success(let result):
            result
        case .failure(let error):
            throw error
        }
    }
}

enum ControlledShiftSwapReadOutcome {
    case success([ShiftSwapRequest])
    case failure(RepositoryError)

    func value() throws -> [ShiftSwapRequest] {
        switch self {
        case .success(let requests):
            requests
        case .failure(let error):
            throw error
        }
    }
}

private enum ControlledShiftSwapMutationRepositoryError: Error {
    case unexpectedTransition
}

private actor ControlledShiftSwapMutationMilestone {
    private var isReached = false
    private var nextWaiterID = 0
    private var waiters: [Int: CheckedContinuation<Void, any Error>] = [:]

    func wait() async throws {
        guard !isReached else { return }
        let waiterID = nextWaiterID
        nextWaiterID += 1

        try await withTaskCancellationHandler {
            try Task.checkCancellation()
            try await withCheckedThrowingContinuation { continuation in
                if isReached {
                    continuation.resume()
                } else {
                    waiters[waiterID] = continuation
                }
            }
        } onCancel: {
            Task { await self.cancelWaiter(waiterID) }
        }
    }

    func reach() {
        guard !isReached else { return }
        isReached = true
        let continuations = waiters.values
        waiters.removeAll()
        continuations.forEach { $0.resume() }
    }

    private func cancelWaiter(_ waiterID: Int) {
        waiters.removeValue(forKey: waiterID)?.resume(throwing: CancellationError())
    }
}

private actor ControlledShiftSwapMutationOperation {
    private let started = ControlledShiftSwapMutationMilestone()
    private var outcome: ControlledShiftSwapMutationOutcome?
    private var outcomeWaiters: [CheckedContinuation<ControlledShiftSwapMutationOutcome, Never>] = []

    func run() async throws -> ShiftSwapTransitionResult {
        await started.reach()
        let resolvedOutcome = await withCheckedContinuation { continuation in
            if let outcome {
                continuation.resume(returning: outcome)
            } else {
                outcomeWaiters.append(continuation)
            }
        }
        return try resolvedOutcome.value()
    }

    func waitUntilStarted() async throws {
        try await started.wait()
    }

    func complete(_ outcome: ControlledShiftSwapMutationOutcome) {
        guard self.outcome == nil else { return }
        self.outcome = outcome
        let waiters = outcomeWaiters
        outcomeWaiters.removeAll()
        waiters.forEach { $0.resume(returning: outcome) }
    }
}

private actor ControlledShiftSwapReadOperation {
    private let started = ControlledShiftSwapMutationMilestone()
    private var outcome: ControlledShiftSwapReadOutcome?
    private var outcomeWaiters: [CheckedContinuation<ControlledShiftSwapReadOutcome, Never>] = []

    func run() async throws -> [ShiftSwapRequest] {
        await started.reach()
        let resolvedOutcome = await withCheckedContinuation { continuation in
            if let outcome {
                continuation.resume(returning: outcome)
            } else {
                outcomeWaiters.append(continuation)
            }
        }
        return try resolvedOutcome.value()
    }

    func waitUntilStarted() async throws {
        try await started.wait()
    }

    func complete(_ outcome: ControlledShiftSwapReadOutcome) {
        guard self.outcome == nil else { return }
        self.outcome = outcome
        let waiters = outcomeWaiters
        outcomeWaiters.removeAll()
        waiters.forEach { $0.resume(returning: outcome) }
    }
}

final class ControlledShiftSwapMutationRepository: ShiftSwapRequestRepository, Sendable {
    private struct State {
        var records: [ControlledShiftSwapMutationRecord] = []
        var cancelledTransitionIndices = Set<Int>()
        var cancelledReadIndices = Set<Int>()
        var readCount = 0
    }

    private let operations: [ControlledShiftSwapMutationOperation]
    private let readOperations: [ControlledShiftSwapReadOperation]
    private let state = Mutex(State())

    init(operationCount: Int = 1, readOperationCount: Int = 0) {
        operations = (0..<operationCount).map { _ in ControlledShiftSwapMutationOperation() }
        readOperations = (0..<readOperationCount).map { _ in ControlledShiftSwapReadOperation() }
    }

    func allShiftSwapRequests(environment _: SessionEnvironment) async throws -> [ShiftSwapRequest] {
        let index = state.withLock { state in
            defer { state.readCount += 1 }
            return state.readCount
        }
        guard !readOperations.isEmpty else { return [] }
        guard readOperations.indices.contains(index) else {
            throw ControlledShiftSwapMutationRepositoryError.unexpectedTransition
        }
        return try await withTaskCancellationHandler {
            try await readOperations[index].run()
        } onCancel: {
            self.state.withLock { state in
                _ = state.cancelledReadIndices.insert(index)
            }
        }
    }

    func transition(
        _ command: ShiftSwapCommand,
        environment: SessionEnvironment
    ) async throws -> ShiftSwapTransitionResult {
        let index = state.withLock { state in
            let index = state.records.count
            state.records.append(record(for: command, environment: environment))
            return index
        }
        guard operations.indices.contains(index) else {
            throw ControlledShiftSwapMutationRepositoryError.unexpectedTransition
        }
        return try await withTaskCancellationHandler {
            try await operations[index].run()
        } onCancel: {
            self.state.withLock { state in
                _ = state.cancelledTransitionIndices.insert(index)
            }
        }
    }

    func waitUntilTransitionStarts(_ index: Int = 0) async throws {
        try await operations[index].waitUntilStarted()
    }

    func completeTransition(_ index: Int = 0, with outcome: ControlledShiftSwapMutationOutcome) async {
        await operations[index].complete(outcome)
    }

    func waitUntilSwapReadStarts(_ index: Int = 0) async throws {
        try await readOperations[index].waitUntilStarted()
    }

    func completeSwapRead(_ index: Int = 0, with outcome: ControlledShiftSwapReadOutcome) async {
        await readOperations[index].complete(outcome)
    }

    func records() -> [ControlledShiftSwapMutationRecord] {
        state.withLock { $0.records }
    }

    func wasTransitionCancelled(_ index: Int = 0) -> Bool {
        state.withLock { $0.cancelledTransitionIndices.contains(index) }
    }

    func swapReadCount() -> Int {
        state.withLock { $0.readCount }
    }

    func wasSwapReadCancelled(_ index: Int = 0) -> Bool {
        state.withLock { $0.cancelledReadIndices.contains(index) }
    }

    private func record(
        for command: ShiftSwapCommand,
        environment: SessionEnvironment
    ) -> ControlledShiftSwapMutationRecord {
        switch command {
        case .create:
            ControlledShiftSwapMutationRecord(
                kind: .create,
                environment: environment,
                requestId: nil,
                candidateShiftId: nil,
                response: nil
            )
        case .respond(let requestId, let candidateShiftId, let response):
            ControlledShiftSwapMutationRecord(
                kind: .respond,
                environment: environment,
                requestId: requestId,
                candidateShiftId: candidateShiftId,
                response: response
            )
        case .cancel(let requestId):
            ControlledShiftSwapMutationRecord(
                kind: .cancel,
                environment: environment,
                requestId: requestId,
                candidateShiftId: nil,
                response: nil
            )
        case .apply(let requestId, let candidateShiftId):
            ControlledShiftSwapMutationRecord(
                kind: .apply,
                environment: environment,
                requestId: requestId,
                candidateShiftId: candidateShiftId,
                response: nil
            )
        }
    }
}

@MainActor
func makeShiftSwapOwnershipRootViewModel(
    member: Member,
    session: AuthorizedSession? = nil,
    shiftRepository: any ShiftRepository = InMemoryShiftRepository(),
    shiftSwapRequestRepository: any ShiftSwapRequestRepository,
    environmentProvider: @escaping @MainActor () -> SessionEnvironment = { .develop }
) -> AccessRootViewModel {
    let sessionViewModel = SessionViewModel(dependencies: .preview())
    sessionViewModel.mode = .authorized(session ?? authorizedShiftsSession(member: member))
    return AccessRootViewModel(
        sessionViewModel: sessionViewModel,
        productsFeatureDependencies: .preview(),
        ordersFeatureDependencies: .preview(),
        shiftsFeatureDependencies: ShiftsFeatureDependencies(
            shiftRepository: shiftRepository,
            shiftSwapRequestRepository: shiftSwapRequestRepository,
            shiftPlanningRequestRepository: InMemoryShiftPlanningRequestRepository(),
            deliveryCalendarRepository: InMemoryDeliveryCalendarRepository(),
            nowMillisProvider: { 0 },
            environmentProvider: environmentProvider
        ),
        newsNotificationsFeatureDependencies: .preview(),
        sharedProfileFeatureDependencies: .preview(),
        usersFeatureDependencies: .preview(),
        myOrderFreshnessFeatureDependencies: .preview(),
        bylawsFeatureDependencies: .preview(),
        developmentTimeMachine: DevelopmentTimeMachine(),
        startupVersionGateUseCase: ResolveStartupVersionGateUseCase(
            repository: FixedStartupVersionPolicyRepository(policy: nil),
            environment: .develop
        ),
        shouldSkipSplashProvider: { true }
    )
}
