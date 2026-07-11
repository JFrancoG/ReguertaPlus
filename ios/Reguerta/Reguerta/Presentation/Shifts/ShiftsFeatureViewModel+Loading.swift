import Foundation

extension ShiftsFeatureViewModel {
    func handleSessionModeChange(_ mode: SessionMode) {
        switch mode {
        case .authorized(let session):
            let previousMemberId = currentMember?.id
            currentSession = session
            currentMember = session.member
            if previousMemberId != session.member.id {
                dismissedShiftSwapRequestIds = []
                shiftSwapDraft = ShiftSwapDraft()
            }
            Task {
                await refreshShifts()
                await refreshDeliveryCalendar()
            }
        case .signedOut, .unauthorized:
            reset()
        }
    }

    func handleNowOverrideChange() {
        guard currentSession != nil else { return }
        recomputeNextShifts()
    }

    func refreshShifts() async {
        guard let session = authorizedSession else {
            resetShifts()
            return
        }

        isLoadingShifts = true
        async let shifts = shiftRepository.allShifts()
        async let requests = shiftSwapRequestRepository.allShiftSwapRequests()
        let loadedShifts = await shifts
        let loadedRequests = await requests
        guard isCurrentSession(session) else {
            isLoadingShifts = false
            return
        }

        shiftsFeed = loadedShifts
        shiftSwapRequests = loadedRequests.visible(to: session.member.id)
        recomputeNextShifts()
        isLoadingShifts = false
    }

    func refreshDeliveryCalendar() async {
        guard let session = authorizedSession, session.member.isAdmin else {
            resetDeliveryCalendar()
            return
        }

        isLoadingDeliveryCalendar = true
        async let defaultDay = deliveryCalendarRepository.defaultDeliveryDayOfWeek()
        async let overrides = deliveryCalendarRepository.allOverrides()
        defaultDeliveryDayOfWeek = await defaultDay
        deliveryCalendarOverrides = await overrides
        isLoadingDeliveryCalendar = false
    }

    func openCalendarWeekPicker() {
        guard let weekKey = selectedDeliveryCalendarWeekKey ?? futureDeliveryWeeks.first?.weekKey else {
            return
        }
        selectCalendarWeekForEditing(weekKey)
        isDeliveryCalendarWeekPickerPresented = true
    }

    func selectCalendarWeekForEditing(_ weekKey: String) {
        selectedDeliveryCalendarWeekKey = weekKey
        let effectiveWeekday = deliveryCalendarOverrides.first { $0.weekKey == weekKey }?.deliveryDateMillis.deliveryWeekday ??
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
        guard let session = authorizedSession, session.member.isAdmin else { return }
        guard let weekKey = selectedDeliveryCalendarWeekKey else { return }
        let shouldDeleteOverride = selectedDeliveryCalendarOverride != nil &&
            selectedDeliveryCalendarWeekday == defaultDeliveryDayOfWeek
        let override = shouldDeleteOverride ? nil : buildDeliveryCalendarOverride(
            weekKey: weekKey,
            weekday: selectedDeliveryCalendarWeekday,
            updatedByUserId: session.member.id,
            updatedAtMillis: nowMillisProvider()
        )
        guard shouldDeleteOverride || override != nil else { return }

        isSavingDeliveryCalendar = true
        if shouldDeleteOverride {
            await deliveryCalendarRepository.deleteOverride(weekKey: weekKey)
        } else if let override {
            _ = await deliveryCalendarRepository.upsertOverride(override)
        }
        defaultDeliveryDayOfWeek = await deliveryCalendarRepository.defaultDeliveryDayOfWeek()
        deliveryCalendarOverrides = await deliveryCalendarRepository.allOverrides()
        isSavingDeliveryCalendar = false
        isDeliveryCalendarWeekPickerPresented = false
        dismissCalendarEditor()
    }

    func requestShiftPlanning(_ type: ShiftPlanningRequestType) {
        pendingShiftPlanningType = type
    }

    func dismissShiftPlanningRequest() {
        pendingShiftPlanningType = nil
    }

    func confirmShiftPlanningRequest() async {
        guard let type = pendingShiftPlanningType else { return }
        guard let session = authorizedSession, session.member.isAdmin else { return }

        isSubmittingShiftPlanningRequest = true
        _ = await shiftPlanningRequestRepository.submit(
            request: ShiftPlanningRequest(
                id: "",
                type: type,
                requestedByUserId: session.member.id,
                requestedAtMillis: nowMillisProvider(),
                status: .requested
            )
        )
        isSubmittingShiftPlanningRequest = false
        pendingShiftPlanningType = nil
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
        resetShifts()
        resetDeliveryCalendar()
        isSavingDeliveryCalendar = false
        isSubmittingShiftPlanningRequest = false
        isSavingShiftSwapRequest = false
        isUpdatingShiftSwapRequest = false
    }

    func isCurrentSession(_ session: AuthorizedSession) -> Bool {
        guard let latestSession = authorizedSession else { return false }
        return latestSession.principal.uid == session.principal.uid &&
            latestSession.member.id == session.member.id
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
    }
}
