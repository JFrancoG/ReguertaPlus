import Foundation

extension NewsNotificationsFeatureViewModel {
    func openNotificationDetail(eventID: String) async {
        guard let context = captureAuthorizedSessionContext(),
              let event = currentGenericShiftNotification(eventID: eventID, context: context) else {
            clearNotificationShiftDetail()
            return
        }

        let operationID = beginNotificationDetailOperation(eventID: event.id)
        do {
            let detail = try await shiftNotificationDetailRepository.currentDetail(
                eventID: event.id,
                memberID: context.memberID,
                environment: context.environment
            )
            try Task.checkCancellation()
            guard isCurrentNotificationDetailOperation(operationID, context: context),
                  currentGenericShiftNotification(eventID: event.id, context: context) != nil,
                  detail.eventID == event.id,
                  detail.shift.assignedUserIds.contains(context.memberID) else {
                finishNotificationDetailOperation(operationID)
                return
            }
            notificationShiftDetail = detail
        } catch is CancellationError {
            finishNotificationDetailOperation(operationID)
            return
        } catch {
            if isCurrentNotificationDetailOperation(operationID, context: context) {
                feedbackCenter.show(AccessL10nKey.feedbackUnableLoadData)
            }
        }
        finishNotificationDetailOperation(operationID)
    }
}

private extension NewsNotificationsFeatureViewModel {
    func beginNotificationDetailOperation(eventID: String) -> UInt64 {
        nextNotificationDetailOperationId &+= 1
        activeNotificationDetailOperationId = nextNotificationDetailOperationId
        notificationShiftDetail = nil
        loadingNotificationDetailEventID = eventID
        return nextNotificationDetailOperationId
    }

    func isCurrentNotificationDetailOperation(_ operationID: UInt64, context: SessionContext) -> Bool {
        activeNotificationDetailOperationId == operationID && isCurrentSession(context)
    }

    func finishNotificationDetailOperation(_ operationID: UInt64) {
        guard activeNotificationDetailOperationId == operationID else { return }
        activeNotificationDetailOperationId = nil
        loadingNotificationDetailEventID = nil
    }

    func currentGenericShiftNotification(eventID: String, context: SessionContext) -> NotificationEvent? {
        notificationsFeed.first { event in
            event.id == eventID &&
                event.type == "shift_updated" &&
                event.target == "users" &&
                event.userIds == [context.memberID] &&
                event.contentPolicy == .authorizedFetchRequired &&
                event.isVisible(to: context.session.member)
        }
    }
}
