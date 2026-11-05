extension AccessRootViewModel {
    func openShiftNotificationPush(eventID: String) async -> Bool {
        if ShiftNotificationPushReference(eventID: eventID).isCoverage {
            guard isHomeRoute else { return false }
            let coverage = shiftsViewModel.coverage
            await coverage.refreshAccess()
            guard !Task.isCancelled else { return false }
            guard coverage.hasResolvedCurrentAccess, let access = coverage.access else { return false }
            guard access.enabled, coverage.isEnabled else { return true }
            coverage.acceptPush(ShiftNotificationPushReference(eventID: eventID))
            homeDestination = .shiftCoverage
            return true
        }
        guard isHomeRoute,
              newsNotificationsViewModel.captureAuthorizedSessionContext() != nil else {
            return false
        }

        if homeDestination != .notifications {
            skipsNextNotificationsPreparation = true
            homeDestination = .notifications
        }
        await newsNotificationsViewModel.prepareNotificationsRoute(openingEventID: eventID)
        return true
    }
}
