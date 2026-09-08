import Foundation
import Testing

@testable import Reguerta

@MainActor
struct ShiftPlanningObservationRecoveryTests {
    @Test func ownPendingRequestSurvivesOtherAdminsAndDiscoversTheLaterActivation() async {
        let admin = adminMember(id: "admin_1", displayName: "Admin")
        let pending = observation(
            id: "stage-a",
            mode: .stage,
            status: .processing,
            time: 1
        )
        let others = (2...40).map { index in
            observation(id: "preview-b-" + String(index), owner: "admin_2", time: Int64(index))
        }
        let repository = PlanningObservationTestRepository(items: [pending] + others)
        let shifts = CountingObservationShiftRepository()
        let viewModel = makeShiftsViewModel(
            currentMember: admin,
            members: [admin],
            shiftRepository: shifts,
            shiftPlanningRequestRepository: repository
        )
        viewModel.handleSessionModeChange(viewModel.sessionViewModel.mode)
        await repository.waitForObservations(2)
        await awaitCurrentShiftsRefresh(in: viewModel)
        #expect(viewModel.shiftPlanningObservation?.id == "stage-a")

        await repository.publish([observation(id: "stage-a", mode: .stage, time: 1)] + others)
        await repository.waitForObservations(3)
        await waitForCondition { viewModel.shiftPlanningObservation?.status == .completed }
        #expect(viewModel.shiftPlanningObservation?.id == "stage-a")
        #expect(await shifts.readCount == 1)

        await repository.publish([observation(id: "activate-a", mode: .activate, time: 2)] + others)
        await waitForCondition {
            viewModel.shiftPlanningObservation?.id == "activate-a" && !viewModel.isRefreshingShiftsAfterActivation
        }
        #expect(await shifts.readCount == 2)
        let scopes = await repository.scopes
        #expect(scopes.map(\.requestID) == [nil, "stage-a", nil])
        viewModel.reset()
    }

    @Test(arguments: [true, false])
    func transientSourceOrCandidateFailureRecoversWithoutAnotherSession(sourceFails: Bool) async {
        let admin = adminMember(id: "admin_1", displayName: "Admin")
        let reference = candidateReference()
        let completed = observation(id: "stage-a", mode: .stage, candidate: reference)
        let repository = PlanningObservationTestRepository(
            items: [completed],
            sourceFailures: sourceFails ? 1 : 0,
            candidateFailures: sourceFails ? 0 : 1
        )
        let viewModel = makeShiftsViewModel(
            currentMember: admin,
            members: [admin],
            shiftPlanningRequestRepository: repository,
            shiftsRetrySleeper: { _ in }
        )
        viewModel.handleSessionModeChange(viewModel.sessionViewModel.mode)

        await repository.waitForObservations(2)
        await waitForCondition { viewModel.shiftPlanningCandidate?.id == "candidate-a" }

        #expect(viewModel.shiftPlanningCandidate?.positions.first?.assignedUserIds == ["member_7"])
        #expect(viewModel.isLoadingShiftPlanningCandidate == false)
        #expect(await repository.candidateReadCount == (sourceFails ? 1 : 2))
        viewModel.reset()
    }

    @Test func confirmedSubmissionPinsItsIDWhileAnotherOwnRequestIsNewer() async throws {
        let admin = adminMember(id: "admin_1", displayName: "Admin")
        let repository = PlanningObservationTestRepository(items: [observation(id: "other-device", time: 100)])
        let viewModel = makeShiftsViewModel(
            currentMember: admin,
            members: [admin],
            shiftPlanningRequestRepository: repository,
            nowMillisProvider: { 1 }
        )
        viewModel.shiftPlanningDeliverySeasonInput = "2026"
        viewModel.shiftPlanningMarketSeasonInput = "2027"
        viewModel.requestShiftPlanningPreview()
        let requestID = try #require(viewModel.pendingShiftPlanningRequest?.id)

        await viewModel.confirmShiftPlanningRequest()
        await repository.waitForObservations(1)
        await waitForCondition { viewModel.shiftPlanningObservation?.id == requestID }

        #expect(viewModel.shiftPlanningObservation?.status == .requested)
        #expect(await repository.scopes.first?.requestID == requestID)
        viewModel.reset()
    }

    @Test func logoutDuringReadBackoffCannotRestartOrPublishThePreviousAdminsRequest() async {
        let admin = adminMember(id: "admin_1", displayName: "Admin")
        let repository = PlanningObservationTestRepository(items: [observation(id: "stage-a")], sourceFailures: 1)
        let gate = PlanningObservationRetryGate()
        let viewModel = makeShiftsViewModel(
            currentMember: admin,
            members: [admin],
            shiftPlanningRequestRepository: repository,
            shiftsRetrySleeper: { _ in
                await gate.wait()
            }
        )
        viewModel.handleSessionModeChange(viewModel.sessionViewModel.mode)
        await waitForCondition { gate.isWaiting }
        let task = viewModel.shiftPlanningObservationTask

        viewModel.sessionViewModel.mode = .signedOut
        viewModel.handleSessionModeChange(.signedOut)
        gate.resume()
        await task?.value

        #expect(await repository.scopes.count == 1)
        #expect(viewModel.shiftPlanningObservation == nil)
        #expect(viewModel.shiftPlanningCandidate == nil)
    }
}

private func observation(
    id: String,
    owner: String = "admin_1",
    mode: ShiftPlanningMode = .preview,
    status: ShiftPlanningRequestStatus = .completed,
    time: Int64 = 1,
    candidate: ShiftPlanningCandidateReference? = nil
) -> ShiftPlanningRequestObservation {
    ShiftPlanningRequestObservation(
        id: id,
        bundleId: "bundle-a",
        requestedByUserId: owner,
        requestedAtMillis: time,
        mode: mode,
        status: status,
        completedSummary: nil,
        failure: nil,
        candidateReference: candidate
    )
}

private func candidateReference() -> ShiftPlanningCandidateReference {
    ShiftPlanningCandidateReference(
        candidateId: "candidate-a",
        candidateDigest: "shift-planning:v1:sha256:" + String(repeating: "b", count: 64),
        bundleRevision: "revision-a",
        bundleDigest: "shift-planning:v1:sha256:" + String(repeating: "a", count: 64),
        environment: .develop
    )
}

private actor PlanningObservationTestRepository: ShiftPlanningRequestRepository {
    struct Scope {
        let owner: String
        let requestID: String?
    }

    private var items: [ShiftPlanningRequestObservation]
    private var sourceFailures: Int
    private var candidateFailures: Int
    private var waiters: [(Int, CheckedContinuation<Void, Never>)] = []
    private var observers: [
        UUID: (Scope, AsyncThrowingStream<ShiftPlanningRequestObservation?, any Error>.Continuation)
    ] = [:]
    private(set) var scopes: [Scope] = []
    private(set) var candidateReadCount = 0

    init(items: [ShiftPlanningRequestObservation], sourceFailures: Int = 0, candidateFailures: Int = 0) {
        self.items = items
        self.sourceFailures = sourceFailures
        self.candidateFailures = candidateFailures
    }

    func submit(request: ShiftPlanningRequest, environment _: SessionEnvironment) -> ShiftPlanningRequest {
        items.append(
            observation(
                id: request.id,
                owner: request.requestedByUserId,
                status: .requested,
                time: request.requestedAtMillis
            )
        )
        return request
    }

    func observeV2Request(
        environment _: SessionEnvironment,
        requestedByUserID: String,
        requestID: String?
    ) -> AsyncThrowingStream<ShiftPlanningRequestObservation?, any Error> {
        let scope = Scope(owner: requestedByUserID, requestID: requestID)
        scopes.append(scope)
        let readyWaiters = waiters.filter { $0.0 <= scopes.count }
        waiters.removeAll { $0.0 <= scopes.count }
        readyWaiters.forEach {
            $0.1.resume()
        }
        let pair = AsyncThrowingStream<ShiftPlanningRequestObservation?, any Error>.makeStream()
        if sourceFailures > 0 {
            sourceFailures -= 1
            pair.continuation.finish(throwing: RepositoryError.unavailable(resource: "planning.source"))
        } else {
            let id = UUID()
            observers[id] = (scope, pair.continuation)
            pair.continuation.onTermination = { [weak self] _ in
                Task {
                    await self?.removeObserver(id)
                }
            }
            pair.continuation.yield(selectedItem(scope))
        }
        return pair.stream
    }

    func publish(_ items: [ShiftPlanningRequestObservation]) {
        self.items = items
        for (scope, continuation) in observers.values {
            continuation.yield(selectedItem(scope))
        }
    }

    func stagedCandidate(reference: ShiftPlanningCandidateReference) throws -> ShiftPlanningCandidate {
        candidateReadCount += 1
        if candidateFailures > 0 {
            candidateFailures -= 1
            throw RepositoryError.unavailable(resource: "planning.candidate")
        }
        return ShiftPlanningCandidate(
            id: reference.candidateId,
            bundleRevision: reference.bundleRevision,
            bundleDigest: reference.bundleDigest,
            candidateDigest: reference.candidateDigest,
            positionDocumentCount: 1,
            assignmentPositionCount: 1,
            positions: [
                ShiftPlanningCandidatePosition(
                    id: "delivery-1",
                    type: .delivery,
                    scheduledDate: "2026-09-09",
                    assignedUserIds: ["member_7"],
                    helperUserId: "member_8"
                )
            ]
        )
    }

    func waitForObservations(_ count: Int) async {
        guard scopes.count < count else { return }
        await withCheckedContinuation {
            waiters.append((count, $0))
        }
    }

    private func selectedItem(_ scope: Scope) -> ShiftPlanningRequestObservation? {
        items.filter {
            $0.requestedByUserId == scope.owner && (scope.requestID == nil || $0.id == scope.requestID)
        }.max { $0.requestedAtMillis < $1.requestedAtMillis }
    }

    private func removeObserver(_ id: UUID) {
        observers[id] = nil
    }
}

@MainActor
private final class PlanningObservationRetryGate {
    private var continuation: CheckedContinuation<Void, Never>?
    var isWaiting: Bool { continuation != nil }

    func wait() async {
        await withCheckedContinuation {
            continuation = $0
        }
    }

    func resume() {
        continuation?.resume()
        continuation = nil
    }
}

private actor CountingObservationShiftRepository: ShiftRepository {
    private(set) var readCount = 0

    func allShifts(environment _: SessionEnvironment) -> [ShiftAssignment] {
        readCount += 1
        return []
    }
}
