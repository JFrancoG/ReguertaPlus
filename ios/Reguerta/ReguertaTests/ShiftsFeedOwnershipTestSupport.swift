import Synchronization

@testable import Reguerta

enum ShiftsAuthorizationDrift: CaseIterable {
    case principalAuthentication
    case authenticatedMember
    case selectedMember
    case environment
}

struct ShiftsAuthorizationScenario {
    let initial: AuthorizedSession
    let successor: AuthorizedSession
    let environment: ShiftsEnvironmentBox
}

@MainActor
final class ShiftsEnvironmentBox {
    var value: SessionEnvironment

    init(_ value: SessionEnvironment) {
        self.value = value
    }
}

@MainActor
final class WeakShiftsOwnershipReference<Value: AnyObject> {
    weak var value: Value?

    init(_ value: Value?) {
        self.value = value
    }
}

@MainActor
func authorizedShiftsSession(member: Member, environment: SessionEnvironment = .develop) -> AuthorizedSession {
    AuthorizedSession(
        principal: AuthPrincipal(uid: "auth_\(member.id)", email: member.normalizedEmail),
        authenticatedMember: member,
        member: member,
        members: [member],
        environment: environment
    )
}

func ownershipSwapRequest(id: String, shift: ShiftAssignment, member: Member) -> ShiftSwapRequest {
    shiftSwapRequest(id: id, requestedShiftId: shift.id, requesterUserId: member.id, candidates: [])
}

@MainActor
func seedRoleDriftState(
    in viewModel: ShiftsFeatureViewModel,
    shift: ShiftAssignment,
    request: ShiftSwapRequest
) {
    viewModel.shiftsFeed = [shift]
    viewModel.shiftSwapRequests = [request]
    viewModel.shiftSwapAcknowledgements[request.id] = .create(requestedShiftId: shift.id)
    viewModel.dismissShiftSwapActivity(requestId: request.id)
    viewModel.startCreatingShiftSwap(shiftId: shift.id)
    viewModel.activeSwapSaveOperationId = 41
    viewModel.isSavingShiftSwapRequest = true
    viewModel.activePlanningSubmissionOperationId = 42
    viewModel.isSubmittingShiftPlanningRequest = true
}

@MainActor
func seedAuthorizationBoundaryState(in viewModel: ShiftsFeatureViewModel, shift: ShiftAssignment) {
    viewModel.shiftSwapAcknowledgements["acknowledged"] = .cancel
    viewModel.dismissShiftSwapActivity(requestId: "dismissed")
    viewModel.startCreatingShiftSwap(shiftId: shift.id)
    viewModel.selectedShiftSegment = .market
    viewModel.activeSwapSaveOperationId = 41
    viewModel.isSavingShiftSwapRequest = true
    viewModel.activePlanningSubmissionOperationId = 42
    viewModel.isSubmittingShiftPlanningRequest = true
}

@MainActor
func shiftsAuthorizationScenario(for drift: ShiftsAuthorizationDrift) -> ShiftsAuthorizationScenario {
    let authenticatedAdmin = adminMember(id: "admin_boundary", displayName: "Ana")
    let selectedMember = shiftMember(id: "member_boundary", displayName: "Carmen")
    let replacementMember = shiftMember(id: "member_boundary_successor", displayName: "Javier")
    let environment = ShiftsEnvironmentBox(.develop)
    let initial = AuthorizedSession(
        principal: AuthPrincipal(
            uid: authenticatedAdmin.authUid ?? "",
            email: authenticatedAdmin.normalizedEmail
        ),
        authenticatedMember: authenticatedAdmin,
        member: selectedMember,
        members: [authenticatedAdmin, selectedMember, replacementMember],
        environment: environment.value
    )

    let successor = successorAuthorizationSession(
        for: drift,
        initial: initial,
        replacementMember: replacementMember,
        environment: environment
    )
    return ShiftsAuthorizationScenario(initial: initial, successor: successor, environment: environment)
}

@MainActor
private func successorAuthorizationSession(
    for drift: ShiftsAuthorizationDrift,
    initial: AuthorizedSession,
    replacementMember: Member,
    environment: ShiftsEnvironmentBox
) -> AuthorizedSession {
    switch drift {
    case .principalAuthentication:
        return reauthenticatedAuthorizationSession(from: initial)
    case .authenticatedMember:
        return replacementAuthenticatedAuthorizationSession(from: initial)
    case .selectedMember:
        var successor = initial
        successor.member = replacementMember
        return successor
    case .environment:
        var successor = initial
        successor.environment = .production
        return successor
    }
}

@MainActor
private func reauthenticatedAuthorizationSession(from initial: AuthorizedSession) -> AuthorizedSession {
    let previousAdmin = initial.authenticatedMember
    let reauthenticatedAdmin = Member(
        id: previousAdmin.id,
        displayName: previousAdmin.displayName,
        normalizedEmail: previousAdmin.normalizedEmail,
        authUid: "auth_admin_boundary_successor",
        roles: previousAdmin.roles,
        isActive: true,
        producerCatalogEnabled: true
    )
    var successor = initial
    successor.principal = AuthPrincipal(
        uid: reauthenticatedAdmin.authUid ?? "",
        email: reauthenticatedAdmin.normalizedEmail
    )
    successor.authenticatedMember = reauthenticatedAdmin
    successor.members[0] = reauthenticatedAdmin
    return successor
}

@MainActor
private func replacementAuthenticatedAuthorizationSession(from initial: AuthorizedSession) -> AuthorizedSession {
    let replacementAdmin = adminMember(id: "admin_boundary_successor", displayName: "Elena")
    var successor = initial
    successor.principal = AuthPrincipal(
        uid: replacementAdmin.authUid ?? "",
        email: replacementAdmin.normalizedEmail
    )
    successor.authenticatedMember = replacementAdmin
    successor.members[0] = replacementAdmin
    return successor
}

@MainActor
func makeShiftsOwnershipRootViewModel(
    sessionViewModel: SessionViewModel,
    repository: ControlledShiftsFeedRepository
) -> AccessRootViewModel {
    AccessRootViewModel(
        sessionViewModel: sessionViewModel,
        productsFeatureDependencies: .preview(),
        ordersFeatureDependencies: .preview(),
        shiftsFeatureDependencies: ShiftsFeatureDependencies(
            shiftRepository: repository,
            shiftSwapRequestRepository: repository,
            shiftPlanningRequestRepository: InMemoryShiftPlanningRequestRepository(),
            deliveryCalendarRepository: InMemoryDeliveryCalendarRepository(),
            nowMillisProvider: { 0 },
            environmentProvider: { .develop }
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

private enum ControlledFeedReadFailure: Error {
    case rejected
}

private enum ControlledFeedReadOutcome<Value: Sendable> {
    case success(Value)
    case failure(ControlledFeedReadFailure)

    func value() throws -> Value {
        switch self {
        case .success(let value):
            value
        case .failure(let error):
            throw error
        }
    }
}

private actor ControlledMilestone {
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

private actor ControlledFeedRead<Value: Sendable> {
    private let started = ControlledMilestone()
    private let resolved = ControlledMilestone()
    private var outcome: ControlledFeedReadOutcome<Value>?
    private var outcomeWaiters: [CheckedContinuation<ControlledFeedReadOutcome<Value>, Never>] = []

    func read() async throws -> Value {
        await started.reach()
        let resolvedOutcome = await withCheckedContinuation { continuation in
            if let outcome {
                continuation.resume(returning: outcome)
            } else {
                outcomeWaiters.append(continuation)
            }
        }
        await resolved.reach()
        return try resolvedOutcome.value()
    }

    func waitUntilStarted() async throws {
        try await started.wait()
    }

    func waitUntilResolved() async throws {
        try await resolved.wait()
    }

    func complete(_ outcome: ControlledFeedReadOutcome<Value>) {
        guard self.outcome == nil else { return }
        self.outcome = outcome
        let waiters = outcomeWaiters
        outcomeWaiters.removeAll()
        waiters.forEach { $0.resume(returning: outcome) }
    }
}

final class ControlledShiftsFeedRepository: ShiftRepository, ShiftSwapRequestRepository {
    private struct CancellationState {
        var cancelledShiftReads = Set<Int>()
        var cancelledSwapReads = Set<Int>()
    }

    private let shiftReads: [ControlledFeedRead<[ShiftAssignment]>]
    private let swapReads: [ControlledFeedRead<[ShiftSwapRequest]>]
    private let nextShiftReadIndex = Mutex(0)
    private let nextSwapReadIndex = Mutex(0)
    private let cancellationState = Mutex(CancellationState())

    init(pairCount: Int) {
        shiftReads = (0..<pairCount).map { _ in ControlledFeedRead() }
        swapReads = (0..<pairCount).map { _ in ControlledFeedRead() }
    }

    func allShifts(environment _: SessionEnvironment) async throws -> [ShiftAssignment] {
        let index = nextShiftReadIndex.withLock { nextIndex in
            defer { nextIndex += 1 }
            return nextIndex
        }
        guard shiftReads.indices.contains(index) else { throw ControlledFeedReadFailure.rejected }
        return try await withTaskCancellationHandler {
            try await shiftReads[index].read()
        } onCancel: {
            cancellationState.withLock { state in
                _ = state.cancelledShiftReads.insert(index)
            }
        }
    }

    func allShiftSwapRequests(environment _: SessionEnvironment) async throws -> [ShiftSwapRequest] {
        let index = nextSwapReadIndex.withLock { nextIndex in
            defer { nextIndex += 1 }
            return nextIndex
        }
        guard swapReads.indices.contains(index) else { throw ControlledFeedReadFailure.rejected }
        return try await withTaskCancellationHandler {
            try await swapReads[index].read()
        } onCancel: {
            cancellationState.withLock { state in
                _ = state.cancelledSwapReads.insert(index)
            }
        }
    }

    func upsert(shift: ShiftAssignment, environment _: SessionEnvironment) async throws -> ShiftAssignment {
        shift
    }

    func transition(
        _ command: ShiftSwapCommand,
        environment _: SessionEnvironment
    ) async throws -> ShiftSwapTransitionResult {
        throw ControlledFeedReadFailure.rejected
    }

    func waitUntilPairStarts(_ index: Int) async throws {
        try await shiftReads[index].waitUntilStarted()
        try await swapReads[index].waitUntilStarted()
    }

    func waitUntilPairResolves(_ index: Int) async throws {
        try await shiftReads[index].waitUntilResolved()
        try await swapReads[index].waitUntilResolved()
    }

    func waitUntilShiftReadResolves(_ index: Int) async throws {
        try await shiftReads[index].waitUntilResolved()
    }

    func completeShifts(_ index: Int, shifts: [ShiftAssignment]) async {
        await shiftReads[index].complete(.success(shifts))
    }

    func completeRequests(_ index: Int, requests: [ShiftSwapRequest]) async {
        await swapReads[index].complete(.success(requests))
    }

    func completePair(_ index: Int, shifts: [ShiftAssignment], requests: [ShiftSwapRequest]) async {
        await completeShifts(index, shifts: shifts)
        await completeRequests(index, requests: requests)
    }

    func failShifts(_ index: Int) async {
        await shiftReads[index].complete(.failure(.rejected))
    }

    func wasShiftReadCancelled(_ index: Int) -> Bool {
        cancellationState.withLock { $0.cancelledShiftReads.contains(index) }
    }

    func wasSwapReadCancelled(_ index: Int) -> Bool {
        cancellationState.withLock { $0.cancelledSwapReads.contains(index) }
    }

    func readCounts() -> (shifts: Int, swaps: Int) {
        (
            shifts: nextShiftReadIndex.withLock { $0 },
            swaps: nextSwapReadIndex.withLock { $0 }
        )
    }
}

actor ControlledShiftsRetrySleeper {
    private let started = ControlledMilestone()
    private let cancelled = ControlledMilestone()
    private var continuation: CheckedContinuation<Void, any Error>?
    private var isCancelled = false

    func sleep(for _: Duration) async throws {
        await started.reach()
        try await withTaskCancellationHandler {
            try Task.checkCancellation()
            try await withCheckedThrowingContinuation { continuation in
                self.continuation = continuation
            }
        } onCancel: {
            Task { await self.cancel() }
        }
    }

    func waitUntilStarted() async throws {
        try await started.wait()
    }

    func waitUntilCancelled() async throws {
        try await cancelled.wait()
    }

    private func cancel() async {
        guard !isCancelled else { return }
        isCancelled = true
        continuation?.resume(throwing: CancellationError())
        continuation = nil
        await cancelled.reach()
    }
}

actor CountingDeliveryCalendarRepository: DeliveryCalendarRepository {
    private(set) var readCount = 0
    private(set) var readEnvironments: [SessionEnvironment] = []
    private var nextWaiterID = 0
    private var readCountWaiters: [Int: (count: Int, continuation: CheckedContinuation<Void, any Error>)] = [:]

    func defaultDeliveryDayOfWeek(environment: SessionEnvironment) async -> DeliveryWeekday {
        recordRead(environment: environment)
        return .wednesday
    }

    func allOverrides(environment: SessionEnvironment) async -> [DeliveryCalendarOverride] {
        recordRead(environment: environment)
        return []
    }

    func upsertOverride(
        _ override: DeliveryCalendarOverride,
        environment _: SessionEnvironment
    ) async -> DeliveryCalendarOverride {
        override
    }

    func deleteOverride(weekKey _: String, environment _: SessionEnvironment) async {}

    func waitForReadCount(_ expectedCount: Int) async throws {
        guard readCount < expectedCount else { return }
        let waiterID = nextWaiterID
        nextWaiterID += 1

        try await withTaskCancellationHandler {
            try Task.checkCancellation()
            try await withCheckedThrowingContinuation { continuation in
                if readCount >= expectedCount {
                    continuation.resume()
                } else {
                    readCountWaiters[waiterID] = (expectedCount, continuation)
                }
            }
        } onCancel: {
            Task { await self.cancelWaiter(waiterID) }
        }
    }

    private func recordRead(environment: SessionEnvironment) {
        readCount += 1
        readEnvironments.append(environment)
        let satisfiedWaiters = readCountWaiters.compactMap { waiterID, waiter in
            waiter.count <= readCount ? waiterID : nil
        }
        for waiterID in satisfiedWaiters {
            readCountWaiters.removeValue(forKey: waiterID)?.continuation.resume()
        }
    }

    private func cancelWaiter(_ waiterID: Int) {
        readCountWaiters.removeValue(forKey: waiterID)?.continuation.resume(throwing: CancellationError())
    }
}
