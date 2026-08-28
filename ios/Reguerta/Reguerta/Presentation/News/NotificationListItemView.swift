import SwiftUI

struct NotificationListItemView: View {
    let tokens: ReguertaDesignTokens
    let item: NotificationListItem
    let dateText: String
    let shiftDetail: ShiftNotificationDetail?
    let isLoadingShiftDetail: Bool
    let session: AuthorizedSession?
    let onOpenShiftDetail: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            Text(dateText)
                .font(tokens.typography.label)
                .foregroundStyle(tokens.colors.textSecondary)

            HStack(spacing: tokens.spacing.xs) {
                Image(systemName: item.isRead ? "checkmark.circle.fill" : "circle.fill")
                    .accessibilityHidden(true)
                Text(LocalizedStringKey(notificationStatusKey))
            }
            .font(tokens.typography.label.weight(.semibold))
            .foregroundStyle(item.isRead ? tokens.colors.actionPrimary : tokens.colors.feedbackWarning)
            .accessibilityElement(children: .combine)

            notificationCard
        }
    }

    @ViewBuilder private var notificationCard: some View {
        if item.notification.isShiftDetailReference {
            Button(action: onOpenShiftDetail) {
                notificationCardContent
            }
            .buttonStyle(.plain)
            .disabled(isLoadingShiftDetail)
            .accessibilityHint(LocalizedStringKey(AccessL10nKey.notificationsShiftDetailAction))
        } else {
            notificationCardContent
        }
    }

    private var notificationCardContent: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            HStack(alignment: .firstTextBaseline, spacing: tokens.spacing.sm) {
                Image(systemName: item.notification.iconSystemName)
                    .foregroundStyle(tokens.colors.textPrimary)
                    .accessibilityHidden(true)
                Text(item.notification.title)
                    .font(tokens.typography.titleCard)
                    .foregroundStyle(tokens.colors.textPrimary)
            }

            Text(item.notification.body)
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.textPrimary)

            if item.notification.isShiftDetailReference {
                shiftDetailContent
            }
        }
        .padding(tokens.spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(notificationBackgroundColor)
        .overlay(
            RoundedRectangle(cornerRadius: tokens.radius.md)
                .stroke(tokens.colors.borderSubtle.opacity(0.55), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: tokens.radius.md))
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder private var shiftDetailContent: some View {
        if isLoadingShiftDetail {
            HStack(spacing: tokens.spacing.xs) {
                ProgressView()
                Text(LocalizedStringKey(AccessL10nKey.notificationsShiftDetailLoading))
            }
            .font(tokens.typography.bodySecondary)
            .foregroundStyle(tokens.colors.textSecondary)
        } else if let shiftDetail {
            let shift = shiftDetail.shift
            let names = shift.assignedUserIds.map(resolvedDisplayName).joined(separator: ", ")
            Text(
                l10n(
                    AccessL10nKey.notificationsShiftDetailSummaryFormat,
                    l10n(shift.type.titleKey),
                    localizedShiftNotificationDateTime(shift.dateMillis)
                )
            )
            .font(tokens.typography.bodySecondary.weight(.semibold))
            .foregroundStyle(tokens.colors.textPrimary)
            Text(l10n(AccessL10nKey.notificationsShiftDetailAssignedMembersFormat, names))
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.textPrimary)
            if let helperUserID = shift.helperUserId {
                Text(l10n(AccessL10nKey.notificationsShiftDetailHelperFormat, resolvedDisplayName(helperUserID)))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textPrimary)
            }
        } else {
            Text(LocalizedStringKey(AccessL10nKey.notificationsShiftDetailAction))
                .font(tokens.typography.label.weight(.semibold))
                .foregroundStyle(tokens.colors.actionPrimary)
        }
    }

    private func resolvedDisplayName(_ memberID: String) -> String {
        guard let session else { return memberID }
        return displayName(for: memberID, in: session)
    }

    private var notificationBackgroundColor: Color {
        (item.isRead ? tokens.colors.actionPrimary : tokens.colors.feedbackWarning)
            .opacity(0.15)
    }

    private var notificationStatusKey: String {
        item.isRead
            ? AccessL10nKey.notificationsStatusRead
            : AccessL10nKey.notificationsStatusUnread
    }
}

private extension NotificationEvent {
    var isShiftDetailReference: Bool {
        type == "shift_updated" && contentPolicy == .authorizedFetchRequired
    }
}
