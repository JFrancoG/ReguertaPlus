import SwiftUI

private struct StartupVersionGateCardContent {
    let titleKey: String
    let messageKey: String
    let primaryActionTitleKey: String
    let secondaryActionTitleKey: String?
    let onPrimaryAction: () -> Void
    let onSecondaryAction: (() -> Void)?
}

extension AccessRootRoutingView {
    @ViewBuilder
    var overlayDialogs: some View {
        if showsRecoverSuccessDialog {
            ReguertaDialog(
                type: .info,
                title: l10n(AccessL10nKey.recoverSuccessDialogTitle),
                message: l10n(AccessL10nKey.recoverSuccessDialogMessage),
                primaryAction: ReguertaDialogAction(
                    title: l10n(AccessL10nKey.commonAccept),
                    action: handleRecoverSuccessDialogDismiss
                ),
                onDismiss: handleRecoverSuccessDialogDismiss
            )
        }
        if viewModel.showSessionExpiredDialog {
            ReguertaDialog(
                type: .error,
                title: l10n(AccessL10nKey.sessionExpiredTitle),
                message: l10n(AccessL10nKey.sessionExpiredMessage),
                primaryAction: ReguertaDialogAction(
                    title: l10n(AccessL10nKey.sessionExpiredAction),
                    action: handleSessionExpiredDialogAction
                ),
                onDismiss: handleSessionExpiredDialogAction
            )
        }
        if viewModel.showUnauthorizedDialog {
            ReguertaDialog(
                type: .info,
                title: l10n(AccessL10nKey.unauthorizedDialogTitle),
                message: l10n(AccessL10nKey.unauthorizedDialogMessage),
                primaryAction: ReguertaDialogAction(
                    title: l10n(AccessL10nKey.unauthorizedDialogAction),
                    action: handleUnauthorizedDialogSignOut
                ),
                dismissible: false
            )
        }
        if let article = rootViewModel.newsNotificationsViewModel.pendingNewsDeletionArticle {
            ReguertaDialog(
                type: .error,
                title: l10n(AccessL10nKey.newsDeleteDialogTitle),
                message: l10n(AccessL10nKey.newsDeleteDialogMessage, article.title),
                primaryAction: ReguertaDialogAction(
                    title: l10n(AccessL10nKey.newsDeleteActionConfirm),
                    action: confirmPendingNewsDeletion
                ),
                secondaryAction: ReguertaDialogAction(
                    title: l10n(AccessL10nKey.newsDeleteActionCancel),
                    action: clearPendingNewsDeletion
                ),
                onDismiss: clearPendingNewsDeletion
            )
        }
    }

    @ViewBuilder
    var feedbackMessageRoute: some View {
        if let feedbackKey = feedbackCenter.messageKey {
            ReguertaCard {
                VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                    ReguertaInlineFeedback(localizedKey(feedbackKey))
                    ReguertaButton(
                        localizedKey(AccessL10nKey.dismissMessage),
                        variant: .text,
                        fullWidth: false
                    ) {
                        feedbackCenter.clear()
                    }
                }
            }
        }
    }

    var splashRoute: some View {
        ZStack {
            VStack {
                Spacer(minLength: 0)
                Image("brand_logo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 100.resize, height: 100.resize)
                    .scaleEffect(splashScale)
                    .rotationEffect(.degrees(splashRotation))
                    .opacity(splashOpacity)
                    .task(id: shellState.currentRoute) {
                        startSplashAnimationIfNeeded()
                    }
                Spacer(minLength: 0)
            }

            startupVersionGateOverlay
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    var startupVersionGateOverlay: some View {
        switch startupGateState {
        case .optionalUpdate(let storeURL):
            startupVersionGateCard(
                StartupVersionGateCardContent(
                    titleKey: AccessL10nKey.startupUpdateOptionalTitle,
                    messageKey: AccessL10nKey.startupUpdateMessage,
                    primaryActionTitleKey: AccessL10nKey.startupUpdateActionUpdate,
                    secondaryActionTitleKey: AccessL10nKey.startupUpdateActionLater,
                    onPrimaryAction: {
                        openStoreURL(storeURL)
                        rootViewModel.dismissOptionalStartupUpdate()
                    },
                    onSecondaryAction: {
                        rootViewModel.dismissOptionalStartupUpdate()
                    }
                )
            )
        case .forcedUpdate(let storeURL):
            startupVersionGateCard(
                StartupVersionGateCardContent(
                    titleKey: AccessL10nKey.startupUpdateForcedTitle,
                    messageKey: AccessL10nKey.startupUpdateMessage,
                    primaryActionTitleKey: AccessL10nKey.startupUpdateActionUpdate,
                    secondaryActionTitleKey: nil,
                    onPrimaryAction: {
                        openStoreURL(storeURL)
                    },
                    onSecondaryAction: nil
                )
            )
        case .checking, .ready, .optionalDismissed:
            EmptyView()
        }
    }

    @ViewBuilder
    private func startupVersionGateCard(_ content: StartupVersionGateCardContent) -> some View {
        ReguertaDialog(
            type: content.onSecondaryAction == nil ? .error : .info,
            title: l10n(content.titleKey),
            message: l10n(content.messageKey),
            primaryAction: ReguertaDialogAction(
                title: l10n(content.primaryActionTitleKey),
                action: content.onPrimaryAction
            ),
            secondaryAction: {
                guard let secondaryActionTitleKey = content.secondaryActionTitleKey,
                      let onSecondaryAction = content.onSecondaryAction else { return nil }
                return ReguertaDialogAction(
                    title: l10n(secondaryActionTitleKey),
                    action: onSecondaryAction
                )
            }(),
            onDismiss: content.onSecondaryAction
        )
    }

    func handleSessionExpiredDialogAction() {
        rootViewModel.handleSessionExpiredDialogAction()
    }

    func handleUnauthorizedDialogSignOut() {
        rootViewModel.handleUnauthorizedDialogSignOut()
    }

    func confirmPendingNewsDeletion() {
        Task {
            await rootViewModel.newsNotificationsViewModel.confirmNewsDeletion()
        }
    }

    func clearPendingNewsDeletion() {
        rootViewModel.newsNotificationsViewModel.clearPendingNewsDeletion()
    }

    func openStoreURL(_ rawURL: String) {
        guard let url = URL(string: rawURL.trimmingCharacters(in: .whitespacesAndNewlines)) else {
            return
        }
        openURL(url)
    }

    func handleAuthRouteExit(from previousRoute: AuthShellRoute, to newRoute: AuthShellRoute) {
        rootViewModel.handleAuthRouteExit(from: previousRoute, to: newRoute)
    }

    func handleRecoverSuccessDialogDismiss() {
        rootViewModel.handleRecoverSuccessDialogDismiss()
    }
}
