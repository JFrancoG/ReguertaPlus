import Testing

@testable import Reguerta

@MainActor
struct ShiftPlanningActivationReadBackTests {
    @Test func completedActivationUpdatesBoardAndUpcomingShiftsOnceWithoutRestart() async {
        let admin = adminMember(id: "admin_1", displayName: "Admin")
        let previous = shift(id: "previous", type: .delivery, dateMillis: 1_000, assignedUserIds: [admin.id])
        let activatedDelivery = shift(
            id: "activated-delivery",
            type: .delivery,
            dateMillis: 2_000,
            assignedUserIds: [admin.id]
        )
        let activatedMarket = shift(
            id: "activated-market",
            type: .market,
            dateMillis: 3_000,
            assignedUserIds: [admin.id]
        )
        let shiftRepository = SequencedPlanningShiftRepository(
            reads: [[previous], [activatedDelivery, activatedMarket]]
        )
        let planningRepository = ActivationObservationRepository()
        let viewModel = makeShiftsViewModel(
            currentMember: admin,
            members: [admin],
            shiftRepository: shiftRepository,
            shiftPlanningRequestRepository: planningRepository,
            nowMillisProvider: { 100 }
        )
        viewModel.handleSessionModeChange(viewModel.sessionViewModel.mode)
        await planningRepository.waitUntilObserved()
        await awaitCurrentShiftsRefresh(in: viewModel)
        let initialReadCount = await shiftRepository.readCount
        #expect(viewModel.shiftsFeed == [previous])
        #expect(viewModel.nextDeliveryShift == previous)

        await planningRepository.emit(completedActivationObservation())
        await waitForCondition {
            viewModel.shiftPlanningObservation?.id == "activate-request" &&
                !viewModel.isRefreshingShiftsAfterActivation
        }
        #expect(viewModel.shiftsFeed == [activatedDelivery, activatedMarket])
        #expect(viewModel.deliveryShifts == [activatedDelivery])
        #expect(viewModel.marketShifts == [activatedMarket])
        #expect(viewModel.nextDeliveryShift == activatedDelivery)
        #expect(viewModel.nextMarketShift == activatedMarket)

        await planningRepository.emit(completedActivationObservation())
        await Task.yield()

        #expect(await shiftRepository.readCount == initialReadCount + 1)
    }

    private func completedActivationObservation() -> ShiftPlanningRequestObservation {
        ShiftPlanningRequestObservation(
            id: "activate-request",
            bundleId: "bundle-2026",
            requestedByUserId: "admin_1",
            requestedAtMillis: 1,
            mode: .activate,
            status: .completed,
            completedSummary: nil,
            failure: nil,
            candidateReference: nil
        )
    }
}

private actor ActivationObservationRepository: ShiftPlanningRequestRepository {
    private var continuation: AsyncThrowingStream<ShiftPlanningRequestObservation?, any Error>.Continuation?
    private var observationWaiters: [CheckedContinuation<Void, Never>] = []

    func submit(request: ShiftPlanningRequest, environment _: SessionEnvironment) async -> ShiftPlanningRequest {
        request
    }

    func observeLatestV2Request(
        environment _: SessionEnvironment
    ) async -> AsyncThrowingStream<ShiftPlanningRequestObservation?, any Error> {
        let pair = AsyncThrowingStream<ShiftPlanningRequestObservation?, any Error>.makeStream()
        continuation = pair.continuation
        observationWaiters.forEach { $0.resume() }
        observationWaiters.removeAll()
        return pair.stream
    }

    func emit(_ observation: ShiftPlanningRequestObservation?) {
        continuation?.yield(observation)
    }

    func waitUntilObserved() async {
        guard continuation == nil else { return }
        await withCheckedContinuation { continuation in
            observationWaiters.append(continuation)
        }
    }
}

private actor SequencedPlanningShiftRepository: ShiftRepository {
    private var reads: [[ShiftAssignment]]
    private(set) var readCount = 0

    init(reads: [[ShiftAssignment]]) {
        self.reads = reads
    }

    func allShifts(environment _: SessionEnvironment) -> [ShiftAssignment] {
        readCount += 1
        return reads.isEmpty ? [] : reads.removeFirst()
    }
}
