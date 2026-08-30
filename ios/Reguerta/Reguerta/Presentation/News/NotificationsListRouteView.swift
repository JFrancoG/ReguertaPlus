import SwiftUI

struct NotificationsListRouteView: View {
    let tokens: ReguertaDesignTokens
    let viewModel: NewsNotificationsFeatureViewModel
    let notificationDateText: (NotificationEvent) -> String

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            LazyVStack(alignment: .leading, spacing: tokens.spacing.lg) {
                if viewModel.isLoadingNotifications {
                    Text(LocalizedStringKey(AccessL10nKey.notificationsLoading))
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)
                } else if viewModel.notificationsFeed.isEmpty {
                    Text(LocalizedStringKey(AccessL10nKey.notificationsEmptyState))
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.feedbackError)
                } else {
                    ForEach(viewModel.notificationListItems) { item in
                        NotificationListItemView(
                            tokens: tokens,
                            item: item,
                            dateText: notificationDateText(item.notification),
                            shiftDetail: viewModel.notificationShiftDetail?.eventID == item.id
                                ? viewModel.notificationShiftDetail
                                : nil,
                            isLoadingShiftDetail: viewModel.loadingNotificationDetailEventID == item.id,
                            session: viewModel.currentSession,
                            onOpenShiftDetail: {
                                Task { await viewModel.openNotificationDetail(eventID: item.id) }
                            }
                        )
                    }
                }
            }
            .padding(.bottom, tokens.spacing.sm)
        }
        .scrollDismissesKeyboard(.interactively)
    }
}
