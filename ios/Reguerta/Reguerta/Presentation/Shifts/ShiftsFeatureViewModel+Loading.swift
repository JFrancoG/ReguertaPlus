import Foundation

extension ShiftsFeatureViewModel {
    func refreshDeliveryCalendar(recoversInitialFailure: Bool = false) async {
        guard let context = authorizedSessionContext else {
            resetDeliveryCalendar()
            return
        }

        await refreshDeliveryCalendar(for: context, recoversInitialFailure: recoversInitialFailure)
    }

    func refreshDeliveryCalendar(for context: SessionContext, recoversInitialFailure: Bool = false) async {
        guard isCurrentSession(context) else { return }
        let refreshOperationId = beginCalendarRefreshOperation()
        defer { finishCalendarRefreshOperation(refreshOperationId) }
        do {
            let (loadedDefaultDay, loadedOverrides) = try await performInitialLoadWithRecovery(
                enabled: recoversInitialFailure,
                shouldRetry: { self.isCurrentCalendarRefresh(refreshOperationId, context: context) },
                operation: {
                    async let defaultDay = deliveryCalendarRepository.defaultDeliveryDayOfWeek(
                        environment: context.environment
                    )
                    async let overrides = deliveryCalendarRepository.allOverrides(environment: context.environment)
                    return try await (defaultDay, overrides)
                }
            )
            try Task.checkCancellation()
            guard isCurrentCalendarRefresh(refreshOperationId, context: context) else { return }
            defaultDeliveryDayOfWeek = loadedDefaultDay
            deliveryCalendarOverrides = loadedOverrides
        } catch is CancellationError {
            return
        } catch {
            if isCurrentCalendarRefresh(refreshOperationId, context: context) {
                feedbackCenter.show(AccessL10nKey.feedbackUnableLoadData)
            }
        }
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
        guard let mutation = deliveryCalendarMutation(for: context) else { return }
        guard let mutationOperationId = beginCalendarMutationOperation() else { return }

        defer { finishCalendarMutationOperation(mutationOperationId) }
        let persistedOverride: DeliveryCalendarOverride?
        do {
            persistedOverride = try await persistDeliveryCalendarMutation(
                mutation,
                environment: context.environment
            )
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
        let existingOverride = selectedDeliveryCalendarOverride
        let defaultWeekday = defaultDeliveryDayOfWeek ?? .wednesday
        if selectedDeliveryCalendarWeekday == defaultWeekday {
            return existingOverride == nil ? nil : .delete(weekKey: weekKey)
        }
        guard existingOverride?.deliveryDateMillis.deliveryWeekday != selectedDeliveryCalendarWeekday else {
            return nil
        }
        guard let override = DeliveryCalendarOverride.weeklyException(
            weekKey: weekKey,
            weekday: selectedDeliveryCalendarWeekday,
            updatedByUserId: context.session.member.id,
            updatedAtMillis: nowMillisProvider()
        ) else { return nil }
        return .upsert(override)
    }

    private func persistDeliveryCalendarMutation(
        _ mutation: DeliveryCalendarMutation,
        environment: SessionEnvironment
    ) async throws -> DeliveryCalendarOverride? {
        switch mutation {
        case .delete(let weekKey):
            try await deliveryCalendarRepository.deleteOverride(weekKey: weekKey, environment: environment)
            return nil
        case .upsert(let override):
            return try await deliveryCalendarRepository.upsertOverride(override, environment: environment)
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

    func requestShiftPlanningPreview() {
        guard authorizedSessionContext?.session.member.isAdmin == true else { return }
        guard let deliverySeason = Int(shiftPlanningDeliverySeasonInput),
              let marketSeason = Int(shiftPlanningMarketSeasonInput),
              (2000...9998).contains(deliverySeason),
              (2000...9998).contains(marketSeason),
              let memberID = authorizedSessionContext?.session.member.id else { return }
        if pendingShiftPlanningRequest?.deliveryTargetSeasonStartYear == deliverySeason,
           pendingShiftPlanningRequest?.marketTargetSeasonStartYear == marketSeason {
            return
        }
        let requestID = planningRequestIDProvider()
        pendingShiftPlanningRequest = ShiftPlanningRequest(
            id: requestID,
            bundleId: "\(requestID)-bundle",
            requestedByUserId: memberID,
            requestedAtMillis: nowMillisProvider(),
            deliveryTargetSeasonStartYear: deliverySeason,
            marketTargetSeasonStartYear: marketSeason
        )
    }

    func dismissShiftPlanningRequest() {
        pendingShiftPlanningRequest = nil
    }

    func confirmShiftPlanningRequest() async {
        guard let request = pendingShiftPlanningRequest else { return }
        guard let context = authorizedSessionContext, context.session.member.isAdmin else { return }
        guard let submissionOperationId = beginPlanningSubmissionOperation() else { return }

        defer { finishPlanningSubmissionOperation(submissionOperationId) }
        do {
            _ = try await shiftPlanningRequestRepository.submit(
                request: request,
                environment: context.environment
            )
        } catch is CancellationError {
            return
        } catch {
            if isCurrentSession(context) {
                feedbackCenter.show(AccessL10nKey.feedbackUnableSaveChanges)
            }
            return
        }
        guard isCurrentSession(context), pendingShiftPlanningRequest?.id == request.id else { return }
        pendingShiftPlanningRequest = nil
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
        case .authorized(let session) where session.representsActiveAuthorization:
            return session
        case .authorized, .signedOut, .unauthorized:
            return nil
        }
    }

    func reset() {
        resetShiftPlanningObservation()
        invalidateShiftSwapMutationOwner()
        currentSession = nil
        currentMember = nil
        currentEnvironment = nil
        resetShifts()
        resetDeliveryCalendar()
        isSavingDeliveryCalendar = false
        isSubmittingShiftPlanningRequest = false
        activeCalendarRefreshOperationId = nil
        activeCalendarMutationOperationId = nil
        activePlanningSubmissionOperationId = nil
    }

    var authorizedSessionContext: SessionContext? {
        guard let currentSession,
              currentSession.representsActiveAuthorization,
              let currentMember,
              let latestSession = authorizedSession,
              authorizationSignature(for: latestSession) == authorizationSignature(for: currentSession),
              memberAuthorizationSignature(for: currentMember) ==
                  memberAuthorizationSignature(for: currentSession.member),
              currentEnvironment == currentSession.environment,
              environmentProvider() == currentSession.environment else {
            return nil
        }
        return SessionContext(
            session: currentSession,
            generation: sessionIdentityEpoch,
            environment: currentSession.environment,
            sessionStateRevision: sessionViewModel.sessionStateRevision
        )
    }

    func isCurrentSession(_ context: SessionContext) -> Bool {
        guard context.session.representsActiveAuthorization,
              let currentSession,
              currentSession.representsActiveAuthorization,
              let currentMember,
              let latestSession = authorizedSession else {
            return false
        }
        let expectedSignature = authorizationSignature(for: context.session)
        return sessionViewModel.sessionStateRevision == context.sessionStateRevision &&
            authorizationSignature(for: currentSession) == expectedSignature &&
            authorizationSignature(for: latestSession) == expectedSignature &&
            memberAuthorizationSignature(for: currentMember) == expectedSignature.currentMember &&
            sessionIdentityEpoch == context.generation &&
            environmentProvider() == context.environment
    }

    func authorizationSignature(for session: AuthorizedSession) -> SessionAuthorizationSignature {
        SessionAuthorizationSignature(
            principalUID: session.principal.uid,
            authenticatedMember: memberAuthorizationSignature(for: session.authenticatedMember),
            currentMember: memberAuthorizationSignature(for: session.member),
            environment: session.environment
        )
    }

    func memberAuthorizationSignature(for member: Member) -> MemberAuthorizationSignature {
        MemberAuthorizationSignature(
            id: member.id,
            authUID: member.authUid,
            roles: member.roles,
            isActive: member.isActive,
            capabilities: MemberPermissionMatrix.capabilities(for: member)
        )
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

    func resetShifts() {
        resetShiftsFeed()
        dismissedShiftSwapRequestIds = []
        shiftSwapAcknowledgements = [:]
        uncertainShiftSwapMutationIntents = [:]
        shiftSwapDraft = ShiftSwapDraft()
        selectedShiftSegment = .delivery
    }

    func resetShiftsFeed() {
        invalidateShiftsRefreshOwner()
        pendingInitialCalendarHydration = nil
        shiftsFeed = []
        shiftSwapRequests = []
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
        pendingShiftPlanningRequest = nil
    }

    func beginShiftsRefreshOperation() -> UInt64 {
        nextShiftsRefreshOperationId += 1
        activeShiftsRefreshOperationId = nextShiftsRefreshOperationId
        isLoadingShifts = true
        return nextShiftsRefreshOperationId
    }

    func isCurrentShiftsRefresh(_ operationId: UInt64, context: SessionContext) -> Bool {
        activeShiftsRefreshOperationId == operationId && isCurrentSession(context)
    }

    func finishShiftsRefreshOperation(_ operationId: UInt64) {
        guard activeShiftsRefreshOperationId == operationId else { return }
        shiftsRefreshTask = nil
        activeShiftsRefreshOperationId = nil
        isLoadingShifts = false
    }

    func invalidateShiftsRefreshOwner() {
        activeShiftsRefreshOperationId = nil
        shiftsRefreshTask?.cancel()
        shiftsRefreshTask = nil
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

    private func finishCalendarRefreshOperation(_ operationId: UInt64) {
        guard activeCalendarRefreshOperationId == operationId else { return }
        activeCalendarRefreshOperationId = nil
        isLoadingDeliveryCalendar = false
    }

    private func beginCalendarMutationOperation() -> UInt64? {
        guard activeCalendarMutationOperationId == nil, !isSavingDeliveryCalendar else { return nil }
        nextCalendarMutationOperationId += 1
        activeCalendarMutationOperationId = nextCalendarMutationOperationId
        isSavingDeliveryCalendar = true
        return nextCalendarMutationOperationId
    }

    private func finishCalendarMutationOperation(_ operationId: UInt64) {
        guard activeCalendarMutationOperationId == operationId else { return }
        activeCalendarMutationOperationId = nil
        isSavingDeliveryCalendar = false
    }

    private func beginPlanningSubmissionOperation() -> UInt64? {
        guard activePlanningSubmissionOperationId == nil, !isSubmittingShiftPlanningRequest else { return nil }
        nextPlanningSubmissionOperationId += 1
        activePlanningSubmissionOperationId = nextPlanningSubmissionOperationId
        isSubmittingShiftPlanningRequest = true
        return nextPlanningSubmissionOperationId
    }

    private func finishPlanningSubmissionOperation(_ operationId: UInt64) {
        guard activePlanningSubmissionOperationId == operationId else { return }
        activePlanningSubmissionOperationId = nil
        isSubmittingShiftPlanningRequest = false
    }

    func reconcileShiftSwapAcknowledgements(with requests: [ShiftSwapRequest]) {
        let requestsById = Dictionary(uniqueKeysWithValues: requests.map { ($0.id, $0) })
        shiftSwapAcknowledgements = shiftSwapAcknowledgements.filter { requestId, acknowledgement in
            guard let request = requestsById[requestId] else { return true }
            return !acknowledgement.isReflected(in: request)
        }
    }
}
