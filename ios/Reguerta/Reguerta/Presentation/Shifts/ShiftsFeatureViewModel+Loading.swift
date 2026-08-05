import Foundation

extension ShiftsFeatureViewModel {
    func handleSessionModeChange(_ mode: SessionMode) {
        switch mode {
        case .authorized(let session):
            let environment = session.environment
            let identityChanged = currentSession?.principal.uid != session.principal.uid ||
                currentSession?.member.id != session.member.id
            let adminAccessChanged = currentMember?.isAdmin != session.member.isAdmin
            let environmentChanged = currentEnvironment.map { $0 != environment } ?? false
            if identityChanged || adminAccessChanged || environmentChanged {
                sessionIdentityEpoch += 1
                reset()
            }
            currentSession = session
            currentMember = session.member
            currentEnvironment = environment
            Task {
                await refreshShifts()
                await refreshDeliveryCalendar()
            }
        case .signedOut, .unauthorized:
            sessionIdentityEpoch += 1
            reset()
        }
    }

    func handleNowOverrideChange() {
        guard currentSession != nil else { return }
        recomputeNextShifts()
    }

    func refreshShifts() async {
        guard let context = authorizedSessionContext else {
            resetShifts()
            return
        }

        let refreshOperationId = beginShiftsRefreshOperation()
        do {
            async let shifts = shiftRepository.allShifts()
            async let requests = shiftSwapRequestRepository.allShiftSwapRequests()
            let (loadedShifts, loadedRequests) = try await (shifts, requests)
            try Task.checkCancellation()
            guard isCurrentShiftsRefresh(refreshOperationId, context: context) else { return }
            shiftsFeed = loadedShifts
            shiftSwapRequests = loadedRequests.visible(to: context.session.member.id)
            reconcileShiftSwapAcknowledgements(with: loadedRequests)
            recomputeNextShifts()
        } catch is CancellationError {
            finishShiftsRefreshOperation(refreshOperationId, context: context)
            return
        } catch {
            if isCurrentShiftsRefresh(refreshOperationId, context: context) {
                feedbackCenter.show(AccessL10nKey.feedbackUnableLoadData)
            }
        }
        finishShiftsRefreshOperation(refreshOperationId, context: context)
    }

    func refreshDeliveryCalendar() async {
        guard let context = authorizedSessionContext, context.session.member.isAdmin else {
            resetDeliveryCalendar()
            return
        }

        let refreshOperationId = beginCalendarRefreshOperation()
        do {
            async let defaultDay = deliveryCalendarRepository.defaultDeliveryDayOfWeek()
            async let overrides = deliveryCalendarRepository.allOverrides()
            let (loadedDefaultDay, loadedOverrides) = try await (defaultDay, overrides)
            try Task.checkCancellation()
            guard isCurrentCalendarRefresh(refreshOperationId, context: context) else { return }
            defaultDeliveryDayOfWeek = loadedDefaultDay
            deliveryCalendarOverrides = loadedOverrides
        } catch is CancellationError {
            finishCalendarRefreshOperation(refreshOperationId, context: context)
            return
        } catch {
            if isCurrentCalendarRefresh(refreshOperationId, context: context) {
                feedbackCenter.show(AccessL10nKey.feedbackUnableLoadData)
            }
        }
        finishCalendarRefreshOperation(refreshOperationId, context: context)
    }

    func openCalendarWeekPicker() {
        guard let weekKey = selectedDeliveryCalendarWeekKey ?? futureDeliveryWeeks.first?.weekKey else { return }
        selectCalendarWeekForEditing(weekKey)
        isDeliveryCalendarWeekPickerPresented = true
    }

    func selectCalendarWeekForEditing(_ weekKey: String) {
        selectedDeliveryCalendarWeekKey = weekKey
        let effectiveWeekday =
            deliveryCalendarOverrides.first { $0.weekKey == weekKey }?.deliveryDateMillis.deliveryWeekday ??
            defaultDeliveryDayOfWeek ??
            .wednesday
        selectedDeliveryCalendarWeekday = effectiveWeekday
        originalDeliveryCalendarWeekday = effectiveWeekday
    }

    func dismissCalendarEditor() {
        selectedDeliveryCalendarWeekKey = nil
        selectedDeliveryCalendarWeekday = defaultDeliveryDayOfWeek ?? .wednesday
        originalDeliveryCalendarWeekday = selectedDeliveryCalendarWeekday
    }

    func saveDeliveryCalendarOverride() async {
        guard let context = authorizedSessionContext, context.session.member.isAdmin else { return }
        guard !isSavingDeliveryCalendar else { return }
        guard let mutation = deliveryCalendarMutation(for: context) else { return }

        isSavingDeliveryCalendar = true
        defer {
            if isCurrentSession(context) {
                isSavingDeliveryCalendar = false
            }
        }
        let persistedOverride: DeliveryCalendarOverride?
        do {
            persistedOverride = try await persistDeliveryCalendarMutation(mutation)
        } catch is CancellationError {
            return
        } catch {
            if isCurrentSession(context) {
                feedbackCenter.show(AccessL10nKey.feedbackUnableSaveChanges)
            }
            return
        }
        guard isCurrentSession(context) else { return }
        applyConfirmedDeliveryCalendarOverride(
            persistedOverride,
            weekKey: mutation.weekKey
        )
        isDeliveryCalendarWeekPickerPresented = false
        dismissCalendarEditor()
        await refreshDeliveryCalendar()
    }

    private func deliveryCalendarMutation(for context: SessionContext) -> DeliveryCalendarMutation? {
        guard let weekKey = selectedDeliveryCalendarWeekKey else { return nil }
        if selectedDeliveryCalendarOverride != nil,
           selectedDeliveryCalendarWeekday == defaultDeliveryDayOfWeek {
            return .delete(weekKey: weekKey)
        }
        guard let override = buildDeliveryCalendarOverride(
            weekKey: weekKey,
            weekday: selectedDeliveryCalendarWeekday,
            updatedByUserId: context.session.member.id,
            updatedAtMillis: nowMillisProvider()
        ) else { return nil }
        return .upsert(override)
    }

    private func persistDeliveryCalendarMutation(
        _ mutation: DeliveryCalendarMutation
    ) async throws -> DeliveryCalendarOverride? {
        switch mutation {
        case .delete(let weekKey):
            try await deliveryCalendarRepository.deleteOverride(weekKey: weekKey)
            return nil
        case .upsert(let override):
            return try await deliveryCalendarRepository.upsertOverride(override)
        }
    }

    private func applyConfirmedDeliveryCalendarOverride(
        _ persistedOverride: DeliveryCalendarOverride?,
        weekKey: String
    ) {
        deliveryCalendarOverrides.removeAll { $0.weekKey == weekKey }
        if let persistedOverride {
            deliveryCalendarOverrides.append(persistedOverride)
            deliveryCalendarOverrides.sort { $0.weekKey < $1.weekKey }
        }
    }

    func requestShiftPlanning(_ type: ShiftPlanningRequestType) {
        if pendingShiftPlanningType != type ||
            pendingShiftPlanningRequestId == nil ||
            pendingShiftPlanningRequestedAtMillis == nil {
            pendingShiftPlanningRequestId = planningRequestIDProvider()
            pendingShiftPlanningRequestedAtMillis = nowMillisProvider()
        }
        pendingShiftPlanningType = type
    }

    func dismissShiftPlanningRequest() {
        pendingShiftPlanningType = nil
        pendingShiftPlanningRequestId = nil
        pendingShiftPlanningRequestedAtMillis = nil
    }

    func confirmShiftPlanningRequest() async {
        guard let type = pendingShiftPlanningType else { return }
        guard let requestId = pendingShiftPlanningRequestId, !requestId.isEmpty else { return }
        guard let requestedAtMillis = pendingShiftPlanningRequestedAtMillis else { return }
        guard let context = authorizedSessionContext, context.session.member.isAdmin else { return }
        guard !isSubmittingShiftPlanningRequest else { return }

        isSubmittingShiftPlanningRequest = true
        defer {
            if isCurrentSession(context) {
                isSubmittingShiftPlanningRequest = false
            }
        }
        do {
            _ = try await shiftPlanningRequestRepository.submit(
                request: ShiftPlanningRequest(
                    id: requestId,
                    type: type,
                    requestedByUserId: context.session.member.id,
                    requestedAtMillis: requestedAtMillis,
                    status: .requested
                )
            )
        } catch is CancellationError {
            return
        } catch {
            if isCurrentSession(context) {
                feedbackCenter.show(AccessL10nKey.feedbackUnableSaveChanges)
            }
            return
        }
        guard isCurrentSession(context), pendingShiftPlanningRequestId == requestId else { return }
        pendingShiftPlanningType = nil
        pendingShiftPlanningRequestId = nil
        pendingShiftPlanningRequestedAtMillis = nil
    }
}

private enum DeliveryCalendarMutation {
    case delete(weekKey: String)
    case upsert(DeliveryCalendarOverride)

    var weekKey: String {
        switch self {
        case .delete(let weekKey):
            weekKey
        case .upsert(let override):
            override.weekKey
        }
    }
}

extension ShiftsFeatureViewModel {
    var currentNowMillis: Int64 {
        nowMillisProvider()
    }

    var authorizedSession: AuthorizedSession? {
        switch sessionViewModel.mode {
        case .authorized(let session):
            return session
        case .signedOut, .unauthorized:
            return nil
        }
    }

    func reset() {
        currentSession = nil
        currentMember = nil
        currentEnvironment = nil
        resetShifts()
        resetDeliveryCalendar()
        isSavingDeliveryCalendar = false
        isSubmittingShiftPlanningRequest = false
        isSavingShiftSwapRequest = false
        isUpdatingShiftSwapRequest = false
        activeShiftsRefreshOperationId = nil
        activeCalendarRefreshOperationId = nil
        activeSwapMutationOperationId = nil
    }

    var authorizedSessionContext: SessionContext? {
        guard let currentSession,
              let latestSession = authorizedSession,
              latestSession.principal.uid == currentSession.principal.uid,
              latestSession.member.id == currentSession.member.id,
              latestSession.environment == currentSession.environment,
              currentEnvironment == currentSession.environment,
              environmentProvider() == currentSession.environment else {
            return nil
        }
        return SessionContext(
            session: currentSession,
            generation: sessionIdentityEpoch,
            environment: currentSession.environment
        )
    }

    func isCurrentSession(_ context: SessionContext) -> Bool {
        guard let currentSession,
              let latestSession = authorizedSession else {
            return false
        }
        return currentSession.principal.uid == context.session.principal.uid &&
            currentSession.member.id == context.session.member.id &&
            currentSession.environment == context.environment &&
            latestSession.principal.uid == context.session.principal.uid &&
            latestSession.member.id == context.session.member.id &&
            latestSession.environment == context.environment &&
            sessionIdentityEpoch == context.generation &&
            environmentProvider() == context.environment
    }

    func recomputeNextShifts() {
        guard let memberId = currentMember?.id else {
            nextDeliveryShift = nil
            nextMarketShift = nil
            return
        }
        nextDeliveryShift = shiftsFeed.nextAssignedShift(
            memberId: memberId,
            type: .delivery,
            nowMillis: currentNowMillis
        )
        nextMarketShift = shiftsFeed.nextAssignedShift(
            memberId: memberId,
            type: .market,
            nowMillis: currentNowMillis
        )
    }

    private func resetShifts() {
        shiftsFeed = []
        shiftSwapRequests = []
        dismissedShiftSwapRequestIds = []
        shiftSwapAcknowledgements = [:]
        shiftSwapDraft = ShiftSwapDraft()
        selectedShiftSegment = .delivery
        nextDeliveryShift = nil
        nextMarketShift = nil
        isLoadingShifts = false
    }

    private func resetDeliveryCalendar() {
        defaultDeliveryDayOfWeek = nil
        deliveryCalendarOverrides = []
        isLoadingDeliveryCalendar = false
        isSavingDeliveryCalendar = false
        isDeliveryCalendarWeekPickerPresented = false
        selectedDeliveryCalendarWeekKey = nil
        selectedDeliveryCalendarWeekday = .wednesday
        originalDeliveryCalendarWeekday = .wednesday
        pendingShiftPlanningType = nil
        pendingShiftPlanningRequestId = nil
        pendingShiftPlanningRequestedAtMillis = nil
    }

    private func beginShiftsRefreshOperation() -> UInt64 {
        nextShiftsRefreshOperationId += 1
        activeShiftsRefreshOperationId = nextShiftsRefreshOperationId
        isLoadingShifts = true
        return nextShiftsRefreshOperationId
    }

    private func isCurrentShiftsRefresh(_ operationId: UInt64, context: SessionContext) -> Bool {
        activeShiftsRefreshOperationId == operationId && isCurrentSession(context)
    }

    private func finishShiftsRefreshOperation(_ operationId: UInt64, context: SessionContext) {
        guard isCurrentShiftsRefresh(operationId, context: context) else { return }
        activeShiftsRefreshOperationId = nil
        isLoadingShifts = false
    }

    private func beginCalendarRefreshOperation() -> UInt64 {
        nextCalendarRefreshOperationId += 1
        activeCalendarRefreshOperationId = nextCalendarRefreshOperationId
        isLoadingDeliveryCalendar = true
        return nextCalendarRefreshOperationId
    }

    private func isCurrentCalendarRefresh(_ operationId: UInt64, context: SessionContext) -> Bool {
        activeCalendarRefreshOperationId == operationId && isCurrentSession(context)
    }

    private func finishCalendarRefreshOperation(_ operationId: UInt64, context: SessionContext) {
        guard isCurrentCalendarRefresh(operationId, context: context) else { return }
        activeCalendarRefreshOperationId = nil
        isLoadingDeliveryCalendar = false
    }

    private func reconcileShiftSwapAcknowledgements(with requests: [ShiftSwapRequest]) {
        let requestsById = Dictionary(uniqueKeysWithValues: requests.map { ($0.id, $0) })
        shiftSwapAcknowledgements = shiftSwapAcknowledgements.filter { requestId, acknowledgement in
            guard let request = requestsById[requestId] else { return true }
            return !acknowledgement.isReflected(in: request)
        }
    }
}
