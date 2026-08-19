import SwiftUI

enum GlobalFeedbackPresentationPolicy {
    static let autoDismissDelay: Duration = .seconds(8)

    static func autoDismissDelay(isVoiceOverEnabled: Bool) -> Duration? {
        isVoiceOverEnabled ? nil : autoDismissDelay
    }
}

struct GlobalFeedbackBanner: View {
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

#Preview("Global feedback banner", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    GlobalFeedbackBanner(
        tokens: .light,
        isVoiceOverEnabled: true,
        messageKey: AccessL10nKey.feedbackUnableLoadData,
        dismissTitle: LocalizedStringKey(AccessL10nKey.dismissMessage)
    ) {}
}
