import SwiftUI

enum GlobalFeedbackPresentationPolicy {
    static let autoDismissDelay: Duration = .seconds(8)

    static func autoDismissDelay(isVoiceOverEnabled: Bool) -> Duration? {
        isVoiceOverEnabled ? nil : autoDismissDelay
    }
}

private enum GlobalFeedbackLayout {
    static let maximumWidth: CGFloat = 358
}

struct GlobalFeedbackBanner: View {
    @Environment(\.reguertaMotionPolicy) private var motionPolicy

    let tokens: ReguertaDesignTokens
    let isVoiceOverEnabled: Bool
    let messageKey: String
    let dismissTitle: LocalizedStringKey
    let onDismiss: () -> Void

    var body: some View {
        reguertaCard {
            HStack(alignment: .top, spacing: tokens.spacing.sm) {
                reguertaInlineFeedback(LocalizedStringKey(messageKey))
                Spacer(minLength: tokens.spacing.sm)
                Button {
                    onDismiss()
                } label: {
                    Image(systemName: "xmark")
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.actionPrimary)
                        .padding(tokens.spacing.xs)
                }
                .frame(
                    minWidth: tokens.layout.minimumTouchTarget,
                    minHeight: tokens.layout.minimumTouchTarget
                )
                .buttonStyle(.plain)
                .accessibilityLabel(dismissTitle)
            }
        }
        .frame(maxWidth: GlobalFeedbackLayout.maximumWidth)
        .padding(.horizontal, tokens.spacing.lg)
        .padding(.bottom, tokens.spacing.md)
        .shadow(color: .black.opacity(0.18), radius: tokens.spacing.md, y: tokens.spacing.xs)
        .transition(
            motionPolicy.allowsMaterialAnimation
                ? .move(edge: .bottom).combined(with: .opacity)
                : .identity
        )
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

#Preview("Global feedback banner", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    GlobalFeedbackBanner(
        tokens: .light,
        isVoiceOverEnabled: true,
        messageKey: AccessL10nKey.feedbackUnableLoadData,
        dismissTitle: LocalizedStringKey(AccessL10nKey.dismissMessage)
    ) {}
}
