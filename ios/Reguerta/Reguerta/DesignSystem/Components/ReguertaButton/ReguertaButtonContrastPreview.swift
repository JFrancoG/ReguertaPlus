import SwiftUI

private struct ReguertaButtonContrastPreview: View {
    @Environment(\.reguertaTokens) private var tokens
    @State private var isControlOn = true

    var body: some View {
        VStack(spacing: 12) {
            reguertaButton(LocalizedStringKey(AccessL10nKey.commonAccept)) {}
            reguertaButton(LocalizedStringKey(AccessL10nKey.commonBack), variant: .secondary) {}
            reguertaButton(LocalizedStringKey(AccessL10nKey.deactivate), variant: .destructive) {}
            reguertaButton(
                LocalizedStringKey(AccessL10nKey.commonClear),
                variant: .text,
                fullWidth: false
            ) {}
            reguertaButton(LocalizedStringKey(AccessL10nKey.commonAccept), isEnabled: false) {}
            reguertaButton(LocalizedStringKey(AccessL10nKey.notificationsLoading), isLoading: true) {}
            Toggle(LocalizedStringKey(AccessL10nKey.statusActive), isOn: $isControlOn)
                .tint(tokens.colors.controlAccent)
        }
        .padding()
        .background(tokens.colors.surfacePrimary)
    }
}

#Preview(
    "ReguertaButton",
    traits: .modifier(ReguertaDesignSystemPreviewModifier(fixture: .buttonStates)),
    .fixedLayout(width: 600, height: 820)
) {
    ReguertaButtonContrastPreview()
}
