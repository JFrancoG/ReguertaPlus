import SwiftUI

struct GlobalFeedbackRouteView: View {
    let tokens: ReguertaDesignTokens
    let isVoiceOverEnabled: Bool
    let messageKey: String?
    let dismissTitle: LocalizedStringKey
    let onDismiss: (String) -> Void

    var body: some View {
        if let messageKey {
            GlobalFeedbackBanner(
                tokens: tokens,
                isVoiceOverEnabled: isVoiceOverEnabled,
                messageKey: messageKey,
                dismissTitle: dismissTitle
            ) {
                onDismiss(messageKey)
            }
        }
    }
}

#Preview("Global feedback route", traits: .modifier(ReguertaDesignSystemPreviewModifier())) {
    GlobalFeedbackRouteView(
        tokens: .light,
        isVoiceOverEnabled: true,
        messageKey: AccessL10nKey.feedbackUnableLoadData,
        dismissTitle: LocalizedStringKey(AccessL10nKey.dismissMessage)
    ) { _ in }
}
