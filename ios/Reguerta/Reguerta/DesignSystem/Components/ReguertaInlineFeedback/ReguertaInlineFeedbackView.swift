import SwiftUI

struct ReguertaInlineFeedbackView: View {
    @Environment(\.reguertaTokens) private var tokens

    let configuration: ReguertaInlineFeedbackConfiguration

    var body: some View {
        HStack(spacing: tokens.spacing.sm) {
            Text("•")
                .font(tokens.typography.body)
                .foregroundStyle(configuration.color(tokens: tokens))
            Text(configuration.message)
                .font(tokens.typography.label)
                .foregroundStyle(configuration.color(tokens: tokens))
        }
    }
}

#Preview(
    "ReguertaInlineFeedback",
    traits: .modifier(ReguertaDesignSystemPreviewModifier(fixture: .inlinePrimary)),
    .fixedLayout(width: 320, height: 640)
) {
    reguertaInlineFeedback("common.status.active", kind: .info)
        .padding()
}

#Preview(
    "ReguertaInlineFeedback XXX",
    traits: .modifier(ReguertaDesignSystemPreviewModifier(fixture: .inlineXXX)),
    .fixedLayout(width: 600, height: 820)
) {
    VStack(alignment: .leading, spacing: 12) {
        reguertaInlineFeedback("feedback.unable_load_data", kind: .warning)
        reguertaInlineFeedback("feedback.unable_save_changes", kind: .error)
    }
    .padding()
}

#Preview(
    "ReguertaInlineFeedback AX5 · external Increased Contrast override",
    traits: .modifier(ReguertaDesignSystemPreviewModifier(fixture: .inlineAccessibility)),
    .fixedLayout(width: 320, height: 720)
) {
    reguertaInlineFeedback("feedback.camera_permission_required", kind: .error)
        .padding()
}
