import Testing

@testable import Reguerta

@MainActor
struct P101ShiftsOperationSafetyTests {
    @Test func planningRetryReusesTheSameLogicalRequest() async {
        let admin = adminMember(id: "admin_1", displayName: "Admin")
        let repository = RejectingOncePlanningRepository()
        let now = TestNowProvider(nowMillis: 111)
        let viewModel = makeShiftsViewModel(
            currentMember: admin,
            members: [admin],
            shiftPlanningRequestRepository: repository,
            nowMillisProvider: { now.nowMillis }
        )
        viewModel.shiftPlanningDeliverySeasonInput = "2026"
        viewModel.shiftPlanningMarketSeasonInput = "2027"
        viewModel.requestShiftPlanningPreview()

        await viewModel.confirmShiftPlanningRequest()
        now.nowMillis = 222
        await viewModel.confirmShiftPlanningRequest()

        let requests = await repository.recordedRequests()
        let environments = await repository.recordedEnvironments()
        #expect(requests.count == 2)
        #expect(environments == [.develop, .develop])
        #expect(requests[0].id.isEmpty == false)
        #expect(requests[0].id == requests[1].id)
        #expect(requests[0].requestedAtMillis == 111)
        #expect(requests[0].requestedAtMillis == requests[1].requestedAtMillis)
        #expect(viewModel.pendingShiftPlanningRequest == nil)
    }

    @Test func cancellationDoesNotPublishFailureFeedback() async {
        let member = shiftMember(id: "member_1", displayName: "Carmen")
        let viewModel = makeShiftsViewModel(
            currentMember: member,
            members: [member],
            shiftRepository: CancelledShiftRepository()
        )

        await viewModel.refreshShifts()

        #expect(viewModel.feedbackCenter.messageKey == nil)
        #expect(viewModel.isLoadingShifts == false)
    }

    @Test func staleRefreshFromPreviousLoginCannotReplaceReloggedSnapshot() async {
        let member = shiftMember(id: "member_1", displayName: "Carmen")
        let staleShift = shift(id: "stale", type: .market, dateMillis: 10, assignedUserIds: [member.id])
        let currentShift = shift(id: "current", type: .market, dateMillis: 20, assignedUserIds: [member.id])
        let repository = SuspendedFirstShiftRepository(subsequentResult: [currentShift])
        let viewModel = makeShiftsViewModel(
            currentMember: member,
            members: [member],
            shiftRepository: repository
        )

        let staleRefresh = Task { await viewModel.refreshShifts() }
        await repository.waitForReadCount(1)
        viewModel.sessionViewModel.mode = .signedOut
        viewModel.handleSessionModeChange(.signedOut)

        let reloggedSession = authorizedSession(for: member)
        viewModel.sessionViewModel.mode = .authorized(reloggedSession)
        viewModel.handleSessionModeChange(.authorized(reloggedSession))
        await repository.waitForReadCount(2)
        await waitForCondition { viewModel.shiftsFeed == [currentShift] }

        await repository.completeFirstRead(with: [staleShift])
        await staleRefresh.value

        #expect(viewModel.shiftsFeed == [currentShift])
        #expect(viewModel.feedbackCenter.messageKey == nil)
    }

    @Test func environmentSwitchClearsThePreviousPathAndFencesItsInFlightRead() async {
        let member = shiftMember(id: "member_1", displayName: "Carmen")
        let staleShift = shift(id: "develop", type: .market, dateMillis: 10, assignedUserIds: [member.id])
        let currentShift = shift(id: "production", type: .market, dateMillis: 20, assignedUserIds: [member.id])
        let repository = SuspendedFirstShiftRepository(subsequentResult: [currentShift])
        let environment = MutableFirestoreEnvironment(.develop)
        let viewModel = makeShiftsViewModel(
            currentMember: member,
            members: [member],
            shiftRepository: repository,
            environmentProvider: { environment.value }
        )
        viewModel.currentEnvironment = .develop
        viewModel.shiftsFeed = [staleShift]
        viewModel.startCreatingShiftSwap(shiftId: staleShift.id)

        let staleRefresh = Task { await viewModel.refreshShifts() }
        await repository.waitForReadCount(1)
        environment.value = .production
        let sameSession = authorizedSession(for: member, environment: .production)
        viewModel.sessionViewModel.mode = .authorized(sameSession)
        viewModel.handleSessionModeChange(.authorized(sameSession))

        #expect(viewModel.shiftSwapDraft == ShiftSwapDraft())
        await repository.waitForReadCount(2)
        await waitForCondition { viewModel.shiftsFeed == [currentShift] }
        await repository.completeFirstRead(with: [staleShift])
        await staleRefresh.value

        #expect(viewModel.currentEnvironment == .production)
        #expect(viewModel.shiftsFeed == [currentShift])
        #expect(viewModel.feedbackCenter.messageKey == nil)
        #expect(await repository.recordedEnvironments() == [.develop, .production])
    }

    private func authorizedSession(
        for member: Member,
        environment: SessionEnvironment = .develop
    ) -> AuthorizedSession {
        AuthorizedSession(
            principal: AuthPrincipal(uid: "auth_\(member.id)", email: member.normalizedEmail),
            authenticatedMember: member,
            member: member,
            members: [member],
            environment: environment
        )
    }
}

@MainActor
private final class CancelledShiftRepository: ShiftRepository {
    func allShifts(environment _: SessionEnvironment) async throws -> [ShiftAssignment] {
        throw CancellationError()
    }
}

private actor RejectingOncePlanningRepository: ShiftPlanningRequestRepository {
    private var requests: [ShiftPlanningRequest] = []
    private var environments: [SessionEnvironment] = []

    func submit(request: ShiftPlanningRequest, environment: SessionEnvironment) async throws -> ShiftPlanningRequest {
        requests.append(request)
        environments.append(environment)
        if requests.count == 1 {
            throw RepositoryError.unavailable(resource: "shiftPlanningRequests")
        }
        return request
    }

    func recordedRequests() -> [ShiftPlanningRequest] {
        requests
    }

    func recordedEnvironments() -> [SessionEnvironment] {
        environments
    }
}

@MainActor
private final class MutableFirestoreEnvironment {
    var value: ReguertaFirestoreEnvironment

    init(_ value: ReguertaFirestoreEnvironment) {
        self.value = value
    }
}

private actor SuspendedFirstShiftRepository: ShiftRepository {
    private let subsequentResult: [ShiftAssignment]
    private var readCount = 0
    private var environments: [SessionEnvironment] = []
    private var firstReadContinuation: CheckedContinuation<[ShiftAssignment], Never>?
    private var readCountWaiters: [(Int, CheckedContinuation<Void, Never>)] = []

    init(subsequentResult: [ShiftAssignment]) {
        self.subsequentResult = subsequentResult
    }

    func allShifts(environment: SessionEnvironment) async throws -> [ShiftAssignment] {
        environments.append(environment)
        readCount += 1
        let completedCount = readCount
        let readyWaiters = readCountWaiters.filter { $0.0 <= completedCount }
        readCountWaiters.removeAll { $0.0 <= completedCount }
        readyWaiters.forEach { $0.1.resume() }
        guard completedCount == 1 else { return subsequentResult }
        return await withCheckedContinuation { firstReadContinuation = $0 }
    }

    func recordedEnvironments() -> [SessionEnvironment] {
        environments
    }

    func waitForReadCount(_ expectedCount: Int) async {
        guard readCount < expectedCount else { return }
        await withCheckedContinuation { continuation in
            readCountWaiters.append((expectedCount, continuation))
        }
    }

    func completeFirstRead(with shifts: [ShiftAssignment]) {
        guard let firstReadContinuation else { return }
        self.firstReadContinuation = nil
        firstReadContinuation.resume(returning: shifts)
    }
}
