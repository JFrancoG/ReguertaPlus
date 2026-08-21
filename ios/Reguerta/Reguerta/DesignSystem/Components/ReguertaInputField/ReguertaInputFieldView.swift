import SwiftUI

enum ReguertaInputFieldLayout {
    static let clearIconHorizontalOffset: CGFloat = -1

    static func actionSize(iconSize: CGFloat, minimumTouchTarget: CGFloat) -> CGFloat {
        max(iconSize, minimumTouchTarget)
    }
}

struct ReguertaInputFieldView: View {
    @Environment(\.reguertaTokens) private var tokens
    @FocusState private var isFocused: Bool
    @Binding var text: String
    @State private var isPasswordVisible = false
    @State private var hasInteracted = false

    let configuration: ReguertaInputFieldConfiguration

    private var effectiveErrorMessage: LocalizedStringKey? {
        configuration.effectiveErrorMessage(text: text, hasInteracted: hasInteracted)
    }

    private var visualState: ReguertaInputState {
        configuration.visualState(text: text, hasInteracted: hasInteracted, isFocused: isFocused)
    }

    private var passwordVisibility: Bool {
        configuration.passwordVisibility(isPasswordVisible: isPasswordVisible)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.xs) {
            Text(configuration.label)
                .font(tokens.typography.label)
                .foregroundStyle(configuration.labelColor(for: visualState, tokens: tokens))
                .accessibilityHidden(true)

            HStack(spacing: tokens.spacing.sm) {
                ReguertaInputTextEntryView(
                    text: $text,
                    isFocused: $isFocused,
                    passwordVisibility: passwordVisibility,
                    errorMessage: effectiveErrorMessage,
                    configuration: configuration
                )

                if configuration.isSecure && configuration.showsPasswordToggle {
                    Button {
                        togglePasswordVisibility()
                    } label: {
                        Image(systemName: passwordVisibility ? "eye.slash" : "eye")
                            .foregroundStyle(tokens.colors.textSecondary)
                            .frame(
                                width: tokens.icons.prominent,
                                height: tokens.icons.prominent
                            )
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
                    .disabled(!configuration.isEnabled)
                    .accessibilityLabel(
                        Text(
                            LocalizedStringKey(
                                passwordVisibility
                                    ? AccessL10nKey.commonHidePassword
                                    : AccessL10nKey.commonShowPassword
                            )
                        )
                    )
                }

                if configuration.showsClearAction && configuration.isEnabled && !text.isEmpty {
                    Button {
                        clearText()
                    } label: {
                        Image(systemName: "xmark")
                            .foregroundStyle(tokens.colors.textSecondary)
                            .frame(
                                width: tokens.icons.prominent,
                                height: tokens.icons.prominent
                            )
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
                            .offset(x: ReguertaInputFieldLayout.clearIconHorizontalOffset)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(Text("common.action.clear"))
                }

                ReguertaInputTrailingIconView(configuration: configuration)
            }
            .padding(.vertical, tokens.spacing.xs)

            Rectangle()
                .fill(configuration.lineColor(for: visualState, tokens: tokens))
                .frame(height: 1)

            ReguertaInputMessageView(
                errorMessage: effectiveErrorMessage,
                helperMessage: configuration.helperMessage
            )
        }
        .onChange(of: isFocused) { _, newValue in
            updateInteractionState(newValue)
        }
    }

    private func togglePasswordVisibility() {
        if let sharedPasswordVisibility = configuration.sharedPasswordVisibility {
            sharedPasswordVisibility.wrappedValue.toggle()
            return
        }
        isPasswordVisible.toggle()
    }

    private func clearText() {
        text = ""
    }

    private func updateInteractionState(_ newValue: Bool) {
        if newValue {
            hasInteracted = true
        }
    }
}

#Preview(
    "Input compact",
    traits: .modifier(ReguertaDesignSystemPreviewModifier(fixture: .inputCompact)),
    .fixedLayout(width: 320, height: 640)
) {
    reguertaInputField(
        "Email",
        text: .constant("member@example.com"),
        helperMessage: "Helper message"
    )
    .padding()
}

#Preview(
    "Input states",
    traits: .modifier(ReguertaDesignSystemPreviewModifier(fixture: .inputStates)),
    .fixedLayout(width: 600, height: 820)
) {
    @Previewable @State var email = "member@example.com"
    @Previewable @State var password = "secret-password"

    VStack(spacing: 20) {
        reguertaInputField(
            "Email",
            text: $email,
            placeholder: "name@example.com",
            helperMessage: "Helper message",
            showsClearAction: true
        )
        reguertaInputField(
            "Password",
            text: $password,
            placeholder: "Password",
            isSecure: true
        )
        reguertaInputField(
            "Invalid value",
            text: .constant("Not valid"),
            errorMessage: "Review this value"
        )
        reguertaInputField(
            "Disabled field",
            text: .constant("Unavailable"),
            isEnabled: false
        )
    }
    .frame(maxWidth: 720)
    .padding()
}

#Preview(
    "Input AX5 · external Increased Contrast override",
    traits: .modifier(ReguertaDesignSystemPreviewModifier(fixture: .inputAccessibility)),
    .fixedLayout(width: 320, height: 720)
) {
    ScrollView(.vertical, showsIndicators: true) {
        reguertaInputField(
            "Detailed delivery instructions",
            text: .constant("Leave the order beside the community room entrance"),
            helperMessage: "Include enough information so another member can find the delivery point",
            showsClearAction: true,
            isMultiline: true
        )
        .padding()
    }
}
