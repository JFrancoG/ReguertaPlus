import Foundation

extension ShiftsFeatureViewModel {
    func handleSessionModeChange(_ mode: SessionMode) {
        switch mode {
        case .authorized(let session):
            guard session.representsActiveAuthorization else {
                sessionIdentityEpoch += 1
                reset()
                return
            }
            let environment = session.environment
            let identityChanged = currentSession.map {
                $0.principal.uid != session.principal.uid ||
                    $0.authenticatedMember.id != session.authenticatedMember.id ||
                    $0.authenticatedMember.authUid != session.authenticatedMember.authUid ||
                    $0.member.id != session.member.id
            } ?? false
            let adminAccessChanged = currentMember.map { $0.isAdmin != session.member.isAdmin } ?? false
            let authorizationChanged = currentSession.map {
                authorizationSignature(for: $0) != authorizationSignature(for: session)
            } ?? false
            let memberAuthorizationChanged = currentMember.map {
                memberAuthorizationSignature(for: $0) != memberAuthorizationSignature(for: session.member)
            } ?? false
            let environmentChanged = currentEnvironment.map { $0 != environment } ?? false
            if identityChanged || adminAccessChanged || environmentChanged {
                sessionIdentityEpoch += 1
                reset()
            } else if authorizationChanged || memberAuthorizationChanged {
                sessionIdentityEpoch += 1
                resetShiftsFeed()
            }
            currentSession = session
            currentMember = session.member
            currentEnvironment = environment
            _ = startShiftsRefresh(recoversInitialFailure: true, startsInitialCalendarHydration: true)
        case .signedOut, .unauthorized:
            sessionIdentityEpoch += 1
            reset()
        }
    }

    func handleNowOverrideChange() {
        guard currentSession != nil else { return }
        recomputeNextShifts()
    }

    func refreshShifts(recoversInitialFailure: Bool = false) async {
        guard !Task.isCancelled,
              let refreshTask = startShiftsRefresh(recoversInitialFailure: recoversInitialFailure) else { return }
        await withTaskCancellationHandler {
            _ = await refreshTask.value
        } onCancel: {
            refreshTask.cancel()
        }
    }

    func requestShiftsRefresh(recoversInitialFailure: Bool = false) {
        _ = startShiftsRefresh(recoversInitialFailure: recoversInitialFailure)
    }

    private func startShiftsRefresh(
        recoversInitialFailure: Bool,
        startsInitialCalendarHydration: Bool = false
    ) -> Task<Void, Never>? {
        guard let context = authorizedSessionContext else {
            resetShifts()
            return nil
        }

        let inheritedHydrationGeneration = pendingInitialCalendarHydration.flatMap { hydration in
            matchesSessionContext(hydration.context, context) ? hydration.generation : nil
        }
        shiftsRefreshTask?.cancel()
        let refreshOperationId = beginShiftsRefreshOperation()
        let hydrationGeneration: UInt64?
        if startsInitialCalendarHydration {
            nextInitialCalendarHydrationGeneration += 1
            hydrationGeneration = nextInitialCalendarHydrationGeneration
        } else {
            hydrationGeneration = inheritedHydrationGeneration
        }
        pendingInitialCalendarHydration = hydrationGeneration.map {
            PendingInitialCalendarHydration(
                generation: $0,
                context: context,
                feedOperationId: refreshOperationId
            )
        }
        let owner = ShiftsFeedRefreshOwner(
            viewModel: self,
            context: context,
            operationId: refreshOperationId,
            recoversInitialFailure: recoversInitialFailure,
            shiftRepository: shiftRepository,
            shiftSwapRequestRepository: shiftSwapRequestRepository,
            retrySleeper: shiftsRetrySleeper
        )
        let refreshTask = Task<Void, Never> { @MainActor in
            await owner.run()
        }
        shiftsRefreshTask = refreshTask
        return refreshTask
    }

    func schedulePendingInitialCalendarHydration(after operationId: UInt64, context: SessionContext) {
        guard let hydration = pendingInitialCalendarHydration,
              hydration.feedOperationId == operationId,
              matchesSessionContext(hydration.context, context),
              isCurrentShiftsRefresh(operationId, context: context) else { return }

        Task { @MainActor [weak self] in
            guard let self,
                  let hydrationContext = claimPendingInitialCalendarHydration(
                      after: operationId,
                      context: context
                  ) else { return }
            await refreshDeliveryCalendar(for: hydrationContext, recoversInitialFailure: true)
        }
    }

    private func claimPendingInitialCalendarHydration(
        after operationId: UInt64,
        context: SessionContext
    ) -> SessionContext? {
        guard activeShiftsRefreshOperationId == nil,
              nextShiftsRefreshOperationId == operationId,
              let hydration = pendingInitialCalendarHydration,
              hydration.feedOperationId == operationId,
              matchesSessionContext(hydration.context, context),
              isCurrentSession(hydration.context) else { return nil }
        pendingInitialCalendarHydration = nil
        return hydration.context
    }

    private func matchesSessionContext(_ lhs: SessionContext, _ rhs: SessionContext) -> Bool {
        lhs.generation == rhs.generation &&
            lhs.sessionStateRevision == rhs.sessionStateRevision &&
            lhs.environment == rhs.environment &&
            authorizationSignature(for: lhs.session) == authorizationSignature(for: rhs.session)
    }
}

@MainActor
private final class ShiftsFeedRefreshOwner {
    private weak var viewModel: ShiftsFeatureViewModel?
    private let context: ShiftsFeatureViewModel.SessionContext
    private let operationId: UInt64
    private let recoversInitialFailure: Bool
    private let shiftRepository: any ShiftRepository
    private let shiftSwapRequestRepository: any ShiftSwapRequestRepository
    private let retrySleeper: @MainActor (Duration) async throws -> Void

    init(
        viewModel: ShiftsFeatureViewModel,
        context: ShiftsFeatureViewModel.SessionContext,
        operationId: UInt64,
        recoversInitialFailure: Bool,
        shiftRepository: any ShiftRepository,
        shiftSwapRequestRepository: any ShiftSwapRequestRepository,
        retrySleeper: @escaping @MainActor (Duration) async throws -> Void
    ) {
        self.viewModel = viewModel
        self.context = context
        self.operationId = operationId
        self.recoversInitialFailure = recoversInitialFailure
        self.shiftRepository = shiftRepository
        self.shiftSwapRequestRepository = shiftSwapRequestRepository
        self.retrySleeper = retrySleeper
    }

    func run() async {
        defer {
            viewModel?.schedulePendingInitialCalendarHydration(after: operationId, context: context)
            viewModel?.finishShiftsRefreshOperation(operationId)
        }
        do {
            try Task.checkCancellation()
            let (loadedShifts, loadedRequests) = try await performInitialLoadWithRecovery(
                enabled: recoversInitialFailure,
                shouldRetry: { [weak self] in
                    guard let self else { return false }
                    return viewModel?.isCurrentShiftsRefresh(operationId, context: context) == true
                },
                sleeper: retrySleeper,
                operation: {
                    async let shifts = shiftRepository.allShifts(environment: context.environment)
                    async let requests = shiftSwapRequestRepository.allShiftSwapRequests(
                        environment: context.environment
                    )
                    return try await (shifts, requests)
                }
            )
            try Task.checkCancellation()
            guard let viewModel,
                  viewModel.isCurrentShiftsRefresh(operationId, context: context) else { return }
            viewModel.shiftsFeed = loadedShifts
            viewModel.shiftSwapRequests = loadedRequests.visible(to: context.session.member.id)
            viewModel.reconcileShiftSwapAcknowledgements(with: loadedRequests)
            viewModel.recomputeNextShifts()
        } catch is CancellationError {
            return
        } catch {
            guard !Task.isCancelled,
                  let viewModel,
                  viewModel.isCurrentShiftsRefresh(operationId, context: context) else { return }
            viewModel.feedbackCenter.show(AccessL10nKey.feedbackUnableLoadData)
        }
    }
}
