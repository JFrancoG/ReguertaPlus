struct HomeOrderStateScope: Equatable, Hashable {
    let localStateScope: MyOrderLocalStateScope
    let sessionStateRevision: UInt64
}

extension AccessRootViewModel {
    var currentHomeOrderStateScope: HomeOrderStateScope? {
        guard homeDestination == .dashboard,
              let session = currentHomeSession,
              session.representsActiveAuthorization else { return nil }
        let baseline = homeWeeklySummaryBaseline(for: session)
        return homeOrderStateScope(for: session, orderWeekKey: baseline.orderWeekKey)
    }

    /// Resolves the dashboard order state without allowing a cancelled or obsolete local read to publish.
    func refreshHomeOrderState(for scope: HomeOrderStateScope?) async {
        guard !Task.isCancelled, currentHomeOrderStateScope == scope else { return }
        homeOrderStateGeneration &+= 1
        let generation = homeOrderStateGeneration
        guard let scope else {
            resolvedHomeOrderStateScope = nil
            homeOrderLocalState = .empty
            return
        }

        let state = await resolveMyOrderLocalStateUseCase.execute(scope: scope.localStateScope)
        guard !Task.isCancelled,
              generation == homeOrderStateGeneration,
              homeDestination == .dashboard,
              currentHomeOrderStateScope == scope else { return }
        resolvedHomeOrderStateScope = scope
        homeOrderLocalState = state
    }

    func homeWeeklySummary(for session: AuthorizedSession) -> HomeWeeklySummaryDisplay {
        let baseline = homeWeeklySummaryBaseline(for: session)
        let scope = homeOrderStateScope(for: session, orderWeekKey: baseline.orderWeekKey)
        let localState = resolvedHomeOrderStateScope == scope ? homeOrderLocalState : .empty
        return HomeWeeklySummaryDisplay(
            weekKey: baseline.weekKey,
            orderWeekKey: baseline.orderWeekKey,
            weekRangeLabel: baseline.weekRangeLabel,
            weekRangeAccessibilityLabel: baseline.weekRangeAccessibilityLabel,
            weekBadgeLabel: baseline.weekBadgeLabel,
            producerName: baseline.producerName,
            deliveryLabel: baseline.deliveryLabel,
            responsibleName: baseline.responsibleName,
            helperName: baseline.helperName,
            marketLabel: baseline.marketLabel,
            marketResponsibleNames: baseline.marketResponsibleNames,
            orderState: resolveHomeDisplayedOrderState(
                isConsultaPhase: baseline.isConsultaPhase,
                orderState: resolveHomeOrderState(localState)
            ),
            isConsultaPhase: baseline.isConsultaPhase
        )
    }

    private func homeWeeklySummaryBaseline(for session: AuthorizedSession) -> HomeWeeklySummaryDisplay {
        resolveHomeWeeklySummaryDisplay(
            nowMillis: shiftsViewModel.currentNowMillis,
            defaultDeliveryDayOfWeek: shiftsViewModel.defaultDeliveryDayOfWeek,
            deliveryCalendarOverrides: shiftsViewModel.deliveryCalendarOverrides,
            shifts: shiftsViewModel.shiftsFeed,
            members: session.members,
            localization: .current
        )
    }

    private func homeOrderStateScope(for session: AuthorizedSession, orderWeekKey: String) -> HomeOrderStateScope {
        HomeOrderStateScope(
            localStateScope: MyOrderLocalStateScope(
                memberId: session.member.id,
                weekKey: orderWeekKey,
                environment: session.environment
            ),
            sessionStateRevision: sessionViewModel.sessionStateRevision
        )
    }
}
