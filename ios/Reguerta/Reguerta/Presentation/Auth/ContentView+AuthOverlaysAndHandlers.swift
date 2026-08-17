import SwiftUI

private struct StartupVersionGateCardContent {
    let titleKey: String
    let messageKey: String
    let primaryActionTitleKey: String
    let secondaryActionTitleKey: String?
    let onPrimaryAction: () -> Void
    let onSecondaryAction: (() -> Void)?
    var isDismissible = true
}

enum GlobalFeedbackPresentationPolicy {
    static let autoDismissDelay: Duration = .seconds(8)

    static func autoDismissDelay(isVoiceOverEnabled: Bool) -> Duration? {
        isVoiceOverEnabled ? nil : autoDismissDelay
    }
}

private struct GlobalFeedbackBanner: View {
    @Environment(\.accessibilityVoiceOverEnabled) private var isVoiceOverEnabled
    @Environment(\.reguertaTokens) private var tokens

    let messageKey: String
    let dismissTitle: LocalizedStringKey
    let onDismiss: () -> Void

    var body: some View {
        reguertaCard {
            HStack(alignment: .top, spacing: tokens.spacing.sm) {
                reguertaInlineFeedback(LocalizedStringKey(messageKey))
                Spacer(minLength: tokens.spacing.sm)
                Button(action: onDismiss) {
                    Image(systemName: "xmark")
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.actionPrimary)
                        .padding(tokens.spacing.xs)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(dismissTitle)
            }
        }
        .frame(maxWidth: 358.resize)
        .padding(.horizontal, tokens.spacing.lg)
        .padding(.bottom, tokens.spacing.md)
        .shadow(color: .black.opacity(0.18), radius: 12.resize, y: 4.resize)
        .transition(.move(edge: .bottom).combined(with: .opacity))
        .accessibilityIdentifier("global.feedback.banner")
        .task(id: messageKey) {
            guard let delay = GlobalFeedbackPresentationPolicy.autoDismissDelay(
                isVoiceOverEnabled: isVoiceOverEnabled
            ) else { return }
            do {
                try await Task.sleep(for: delay)
            } catch {
                return
            }
            guard !Task.isCancelled else { return }
            onDismiss()
        }
    }
}

extension AccessRootRoutingView {
    @ViewBuilder
    var overlayDialogs: some View {
        if showsRecoverSuccessDialog {
            reguertaDialog(
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
            reguertaDialog(
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
            reguertaDialog(
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

    @ViewBuilder
    var feedbackMessageRoute: some View {
        if let feedbackKey = feedbackCenter.messageKey {
            GlobalFeedbackBanner(
                messageKey: feedbackKey,
                dismissTitle: localizedKey(AccessL10nKey.dismissMessage)
            ) {
                if feedbackCenter.messageKey == feedbackKey {
                    feedbackCenter.clear()
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
        guard let url = URL(string: rawURL.trimmingCharacters(in: .whitespacesAndNewlines)) else { return }
        openURL(url)
    }

    func handleAuthRouteExit(from previousRoute: AuthShellRoute, to newRoute: AuthShellRoute) {
        rootViewModel.handleAuthRouteExit(from: previousRoute, to: newRoute)
    }

    func handleRecoverSuccessDialogDismiss() {
        rootViewModel.handleRecoverSuccessDialogDismiss()
    }
}

private struct StartupGateUnavailablePreview: AccessRootRoutingView {
    let appEnvironment: ReguertaAppEnvironment
    @Environment(\.openURL) var openURL
    @Environment(\.reguertaTokens) var tokens

    var body: some View {
        ZStack {
            Color(.systemBackground).ignoresSafeArea()
            startupVersionGateOverlay
        }
    }
}

#Preview("Startup version unavailable", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    let environment = ReguertaAppEnvironment.preview()
    environment.accessRootViewModel.startupGateState = .unavailable
    return StartupGateUnavailablePreview(appEnvironment: environment)
}

#Preview("Startup version timed out", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    let environment = ReguertaAppEnvironment.preview()
    environment.accessRootViewModel.startupGateState = .timedOut
    return StartupGateUnavailablePreview(appEnvironment: environment)
}
