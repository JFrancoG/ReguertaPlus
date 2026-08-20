import SwiftUI

private enum SplashLayout {
    static let logoSize: CGFloat = 100
}

private struct StartupVersionGateCardContent {
    let titleKey: String
    let messageKey: String
    let primaryActionTitleKey: String
    let secondaryActionTitleKey: String?
    let onPrimaryAction: () -> Void
    let onSecondaryAction: (() -> Void)?
    var isDismissible = true
}

extension RootOverlayView {
    @ViewBuilder
    var overlayDialogs: some View {
        if rootViewModel.showsRecoverSuccessDialog {
            reguertaDialog(
                type: .info,
                title: l10n(AccessL10nKey.recoverSuccessDialogTitle),
                message: l10n(AccessL10nKey.recoverSuccessDialogMessage),
                primaryAction: ReguertaDialogAction(
                    title: l10n(AccessL10nKey.commonAccept),
                    action: rootViewModel.handleRecoverSuccessDialogDismiss
                ),
                onDismiss: rootViewModel.handleRecoverSuccessDialogDismiss
            )
        }
        if sessionViewModel.showSessionExpiredDialog {
            reguertaDialog(
                type: .error,
                title: l10n(AccessL10nKey.sessionExpiredTitle),
                message: l10n(AccessL10nKey.sessionExpiredMessage),
                primaryAction: ReguertaDialogAction(
                    title: l10n(AccessL10nKey.sessionExpiredAction),
                    action: rootViewModel.handleSessionExpiredDialogAction
                ),
                onDismiss: rootViewModel.handleSessionExpiredDialogAction
            )
        }
        if sessionViewModel.showUnauthorizedDialog {
            reguertaDialog(
                type: .info,
                title: l10n(AccessL10nKey.unauthorizedDialogTitle),
                message: l10n(AccessL10nKey.unauthorizedDialogMessage),
                primaryAction: ReguertaDialogAction(
                    title: l10n(AccessL10nKey.unauthorizedDialogAction),
                    action: rootViewModel.handleUnauthorizedDialogSignOut
                ),
                dismissible: false
            )
        }
        if let article = rootViewModel.newsNotificationsViewModel.pendingNewsDeletionArticle {
            reguertaDialog(
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

    func confirmPendingNewsDeletion() {
        Task {
            await rootViewModel.newsNotificationsViewModel.confirmNewsDeletion()
        }
    }

    func clearPendingNewsDeletion() {
        rootViewModel.newsNotificationsViewModel.clearPendingNewsDeletion()
    }
}

extension AuthShellView {
    var splashRoute: some View {
        ZStack {
            VStack {
                Spacer(minLength: 0)
                Image("brand_logo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: SplashLayout.logoSize, height: SplashLayout.logoSize)
                    .scaleEffect(motionPolicy.materialScale(rootViewModel.splashScale))
                    .rotationEffect(
                        .degrees(motionPolicy.allowsMaterialAnimation ? rootViewModel.splashRotation : 0)
                    )
                    .opacity(motionPolicy.allowsMaterialAnimation ? rootViewModel.splashOpacity : 1)
                    .task(id: rootViewModel.shellState.currentRoute) {
                        withAnimation(splashMaterialAnimation) {
                            rootViewModel.startSplashAnimationIfNeeded()
                        }
                    }
                Spacer(minLength: 0)
            }

            startupVersionGateOverlay
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    var startupVersionGateOverlay: some View {
        switch rootViewModel.startupGateState {
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
        case .timedOut:
            startupVersionGateCard(
                StartupVersionGateCardContent(
                    titleKey: AccessL10nKey.startupValidationTimedOutTitle,
                    messageKey: AccessL10nKey.startupValidationTimedOutMessage,
                    primaryActionTitleKey: AccessL10nKey.startupValidationActionRetry,
                    secondaryActionTitleKey: AccessL10nKey.startupValidationActionContinue,
                    onPrimaryAction: rootViewModel.retryStartupGate,
                    onSecondaryAction: rootViewModel.continueAfterStartupGateFailure,
                    isDismissible: false
                )
            )
        case .unavailable:
            startupVersionGateCard(
                StartupVersionGateCardContent(
                    titleKey: AccessL10nKey.startupValidationUnavailableTitle,
                    messageKey: AccessL10nKey.startupValidationUnavailableMessage,
                    primaryActionTitleKey: AccessL10nKey.startupValidationActionRetry,
                    secondaryActionTitleKey: AccessL10nKey.startupValidationActionContinue,
                    onPrimaryAction: rootViewModel.retryStartupGate,
                    onSecondaryAction: rootViewModel.continueAfterStartupGateFailure,
                    isDismissible: false
                )
            )
        case .checking, .ready, .optionalDismissed:
            EmptyView()
        }
    }

    @ViewBuilder private func startupVersionGateCard(_ content: StartupVersionGateCardContent) -> some View {
        reguertaDialog(
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
            dismissible: content.isDismissible,
            onDismiss: content.isDismissible ? content.onSecondaryAction : nil
        )
    }

    func openStoreURL(_ rawURL: String) {
        guard let url = URL(string: rawURL.trimmingCharacters(in: .whitespacesAndNewlines)) else { return }
        openURL(url)
    }
}

#Preview("Startup version unavailable", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    MainView()
        .reguertaAppEnvironment(startupGatePreviewEnvironment(.unavailable))
}

#Preview("Startup version timed out", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    MainView()
        .reguertaAppEnvironment(startupGatePreviewEnvironment(.timedOut))
}
