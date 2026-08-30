extension AccessRootViewModel {
    func openShiftNotificationPush(eventID: String) async -> Bool {
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
