import SwiftUI

struct ReguertaInputTrailingIconView: View {
    @Environment(\.reguertaTokens) private var tokens

    let configuration: ReguertaInputFieldConfiguration

    var body: some View {
        if let trailingIcon = configuration.trailingIcon {
            if let onTrailingTap = configuration.onTrailingTap {
                Button {
                    onTrailingTap()
                } label: {
                    trailingIcon
                        .foregroundStyle(tokens.colors.textSecondary)
                        .frame(
                            minWidth: ReguertaInputFieldLayout.actionSize(
                                iconSize: tokens.icons.prominent,
                                minimumTouchTarget: tokens.layout.minimumTouchTarget
                            ),
                            minHeight: ReguertaInputFieldLayout.actionSize(
                                iconSize: tokens.icons.prominent,
                                minimumTouchTarget: tokens.layout.minimumTouchTarget
                            )
                        )
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            } else {
                trailingIcon
                    .foregroundStyle(tokens.colors.textSecondary)
            }
        }
    }
}

#Preview(
    "Input trailing action · XXX Large",
    traits: .modifier(ReguertaDesignSystemPreviewModifier(fixture: .inputStates)),
    .fixedLayout(width: 600, height: 820)
) {
    ReguertaInputTrailingIconView(
        configuration: ReguertaInputFieldConfiguration(
            label: "Search",
            placeholder: nil,
            helperMessage: nil,
            errorMessage: nil,
            liveValidationMessage: nil,
            liveValidation: nil,
            liveValidationMessageProvider: nil,
            isEnabled: true,
            isReadOnly: false,
            isSecure: false,
            sharedPasswordVisibility: nil,
            showsClearAction: false,
            showsPasswordToggle: false,
            keyboardType: .default,
            textContentType: nil,
            trailingIcon: Image(systemName: "magnifyingglass"),
            onTrailingTap: {},
            accessibilityIdentifier: nil,
            isMultiline: false,
            textInputAutocapitalization: .never,
            autocorrectionDisabled: true
        )
    )
    .padding()
}
