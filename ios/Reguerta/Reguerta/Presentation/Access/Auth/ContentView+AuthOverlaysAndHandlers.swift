import SwiftUI

extension ContentView {
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
        if let article = pendingNewsDeletionArticle {
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
        if let feedbackKey = viewModel.feedbackMessageKey {
            ReguertaCard {
                VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                    ReguertaInlineFeedback(localizedKey(feedbackKey))
                    ReguertaButton(
                        localizedKey(AccessL10nKey.dismissMessage),
                        variant: .text,
                        fullWidth: false
                    ) {
                        viewModel.clearFeedbackMessage()
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
                titleKey: AccessL10nKey.startupUpdateOptionalTitle,
                messageKey: AccessL10nKey.startupUpdateMessage,
                primaryActionTitleKey: AccessL10nKey.startupUpdateActionUpdate,
                secondaryActionTitleKey: AccessL10nKey.startupUpdateActionLater,
                onPrimaryAction: {
                    openStoreURL(storeURL)
                    startupGateState = .optionalDismissed
                },
                onSecondaryAction: {
                    startupGateState = .optionalDismissed
                }
            )
        case .forcedUpdate(let storeURL):
            startupVersionGateCard(
                titleKey: AccessL10nKey.startupUpdateForcedTitle,
                messageKey: AccessL10nKey.startupUpdateMessage,
                primaryActionTitleKey: AccessL10nKey.startupUpdateActionUpdate,
                secondaryActionTitleKey: nil,
                onPrimaryAction: {
                    openStoreURL(storeURL)
                },
                onSecondaryAction: nil
            )
        case .checking, .ready, .optionalDismissed:
            EmptyView()
        }
    }

    @ViewBuilder
    // swiftlint:disable:next function_parameter_count
    func startupVersionGateCard(
        titleKey: String,
        messageKey: String,
        primaryActionTitleKey: String,
        secondaryActionTitleKey: String?,
        onPrimaryAction: @escaping () -> Void,
        onSecondaryAction: (() -> Void)?
    ) -> some View {
        ReguertaDialog(
            type: onSecondaryAction == nil ? .error : .info,
            title: l10n(titleKey),
            message: l10n(messageKey),
            primaryAction: ReguertaDialogAction(
                title: l10n(primaryActionTitleKey),
                action: onPrimaryAction
            ),
            secondaryAction: {
                guard let secondaryActionTitleKey, let onSecondaryAction else { return nil }
                return ReguertaDialogAction(
                    title: l10n(secondaryActionTitleKey),
                    action: onSecondaryAction
                )
            }(),
            onDismiss: onSecondaryAction
        )
    }

    func handleSessionExpiredDialogAction() {
        viewModel.dismissSessionExpiredDialog()
        viewModel.resetSignInDraft()
        dispatchShell(.reauthenticate)
    }

    func handleUnauthorizedDialogSignOut() {
        homeDestination = .dashboard
        viewModel.signOut()
        dispatchShell(.signedOut)
    }

    func confirmPendingNewsDeletion() {
        guard let pendingNewsDeletionId else { return }
        viewModel.deleteNews(newsId: pendingNewsDeletionId) {
            self.pendingNewsDeletionId = nil
        }
    }

    func clearPendingNewsDeletion() {
        pendingNewsDeletionId = nil
    }

    func openStoreURL(_ rawURL: String) {
        guard let url = URL(string: rawURL.trimmingCharacters(in: .whitespacesAndNewlines)) else {
            return
        }
        openURL(url)
    }

    func handleAuthRouteExit(from previousRoute: AuthShellRoute, to newRoute: AuthShellRoute) {
        guard previousRoute != newRoute else { return }
        if previousRoute == .home || newRoute != .home {
            isHomeDrawerOpen = false
            homeDrawerDragOffset = 0
        }

        switch previousRoute {
        case .login where newRoute != .login:
            viewModel.resetSignInDraft()
            viewModel.clearFeedbackMessage()
        case .register where newRoute != .register:
            viewModel.resetSignUpDraft()
            viewModel.clearFeedbackMessage()
            areRegisterPasswordsVisible = false
        case .recoverPassword where newRoute != .recoverPassword:
            viewModel.resetRecoverDraft()
            viewModel.clearFeedbackMessage()
            showsRecoverSuccessDialog = false
        default:
            break
        }
    }

    func handleRecoverSuccessDialogDismiss() {
        showsRecoverSuccessDialog = false
        viewModel.resetRecoverDraft()
        dispatchShell(.signedOut)
    }
}
