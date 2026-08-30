import Testing

@testable import Reguerta

@MainActor
struct ShiftPlanningStagePresentationTests {
    @Test func completedOwnPreviewStagesTheExactObservedBundle() async {
        let admin = adminMember(id: "admin_1", displayName: "Admin")
        let planningRepository = RecordingStagePlanningRepository()
        let viewModel = makeShiftsViewModel(
            currentMember: admin,
            members: [admin],
            shiftPlanningRequestRepository: planningRepository,
            nowMillisProvider: { 321 }
        )
        viewModel.handleSessionModeChange(viewModel.sessionViewModel.mode)
        await planningRepository.waitUntilObserved()
        await planningRepository.emit(completedPreviewObservation())
        await waitForCondition { viewModel.shiftPlanningObservation?.id == "preview-request" }

        viewModel.requestShiftPlanningStage()
        await viewModel.confirmShiftPlanningRequest()

        let request = await planningRepository.submittedRequests().first
        #expect(request?.bundleId == "bundle-2026")
        #expect(request?.deliveryTargetSeasonStartYear == 2026)
        #expect(request?.marketTargetSeasonStartYear == 2027)
        #expect(
            request?.intent == .stage(
                ShiftPlanningPreviewReference(
                    sourceRequestId: "preview-request",
                    bundleRevision: "bundle-revision-1",
                    bundleDigest: previewBundleDigest
                )
            )
        )
        #expect(request?.id != "preview-request")
    }

    @Test func adminCannotStageAnotherAdminsPreview() async {
        let admin = adminMember(id: "admin_1", displayName: "Admin")
        let planningRepository = RecordingStagePlanningRepository()
        let viewModel = makeShiftsViewModel(
            currentMember: admin,
            members: [admin],
            shiftPlanningRequestRepository: planningRepository
        )
        viewModel.handleSessionModeChange(viewModel.sessionViewModel.mode)
        await planningRepository.waitUntilObserved()
        await planningRepository.emit(completedPreviewObservation(requestedByUserID: "admin_2"))
        await waitForCondition { viewModel.shiftPlanningObservation?.id == "preview-request" }

        viewModel.requestShiftPlanningStage()
        await viewModel.confirmShiftPlanningRequest()

        #expect(await planningRepository.submittedRequests().isEmpty)
    }

    private func completedPreviewObservation(
        requestedByUserID: String = "admin_1"
    ) -> ShiftPlanningRequestObservation {
        ShiftPlanningRequestObservation(
            id: "preview-request",
            bundleId: "bundle-2026",
            requestedByUserId: requestedByUserID,
            requestedAtMillis: 1,
            mode: .preview,
            status: .completed,
            completedSummary: ShiftPlanningCompletedSummary(
                bundleRevision: "bundle-revision-1",
                bundleDigest: previewBundleDigest,
                delivery: ShiftPlanningSubplanSummary(
                    targetSeasonStartYear: 2026,
                    generatedShiftCount: 54,
                    affectedProjectionSeasonStartYears: [2026, 2027]
                ),
                market: ShiftPlanningSubplanSummary(
                    targetSeasonStartYear: 2027,
                    generatedShiftCount: 30,
                    affectedProjectionSeasonStartYears: [2027]
                )
            ),
            failure: nil,
            candidateReference: nil
        )
    }
}

private actor RecordingStagePlanningRepository: ShiftPlanningRequestRepository {
    private var continuation: AsyncThrowingStream<ShiftPlanningRequestObservation?, any Error>.Continuation?
    private var observationWaiters: [CheckedContinuation<Void, Never>] = []
    private var requests: [ShiftPlanningRequest] = []

    func submit(request: ShiftPlanningRequest, environment _: SessionEnvironment) async -> ShiftPlanningRequest {
        requests.append(request)
        return request
    }

    func submittedRequests() -> [ShiftPlanningRequest] {
        requests
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

private let previewBundleDigest =
    "shift-planning:v1:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
