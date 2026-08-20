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

            HStack(spacing: tokens.spacing.sm) {
                ReguertaInputTextEntryView(
                    text: $text,
                    isFocused: $isFocused,
                    passwordVisibility: passwordVisibility,
                    configuration: configuration
                )

                if configuration.isSecure && configuration.showsPasswordToggle {
                    Button(action: togglePasswordVisibility) {
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
                        Text(passwordVisibility ? "common.action.hide_password" : "common.action.show_password")
                    )
                }

                if configuration.showsClearAction && configuration.isEnabled && !text.isEmpty {
                    Button(action: clearText) {
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
        .onChange(of: isFocused, updateInteractionState)
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

    private func updateInteractionState(previousValue: Bool, newValue: Bool) {
        if newValue {
            hasInteracted = true
        }
    }
}

private struct ReguertaInputTextEntryView: View {
    @Environment(\.reguertaTokens) private var tokens
    @Binding var text: String
    var isFocused: FocusState<Bool>.Binding

    let passwordVisibility: Bool
    let configuration: ReguertaInputFieldConfiguration

    var body: some View {
        ZStack(alignment: .leading) {
            if let placeholder = configuration.placeholder {
                Text(placeholder)
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary.opacity(0.65))
                    .opacity(text.isEmpty ? 1 : 0)
            }
            if configuration.isSecure && !passwordVisibility {
                SecureField("", text: $text)
                    .font(tokens.typography.body)
                    .disabled(!configuration.isEnabled)
                    .allowsHitTesting(!configuration.isReadOnly)
                    .focused(isFocused)
                    .autocorrectionDisabled(configuration.autocorrectionDisabled)
                    .textInputAutocapitalization(configuration.textInputAutocapitalization)
                    .keyboardType(configuration.keyboardType)
                    .accessibilityLabel(Text(configuration.label))
                    .reguertaOptionalAccessibilityIdentifier(configuration.accessibilityIdentifier)
            } else if configuration.isMultiline {
                TextField("", text: $text, axis: .vertical)
                    .font(tokens.typography.body)
                    .lineLimit(3...6)
                    .disabled(!configuration.isEnabled)
                    .allowsHitTesting(!configuration.isReadOnly)
                    .focused(isFocused)
                    .autocorrectionDisabled(configuration.autocorrectionDisabled)
                    .textInputAutocapitalization(configuration.textInputAutocapitalization)
                    .keyboardType(configuration.keyboardType)
                    .accessibilityLabel(Text(configuration.label))
                    .reguertaOptionalAccessibilityIdentifier(configuration.accessibilityIdentifier)
            } else {
                TextField("", text: $text)
                    .font(tokens.typography.body)
                    .disabled(!configuration.isEnabled)
                    .allowsHitTesting(!configuration.isReadOnly)
                    .focused(isFocused)
                    .autocorrectionDisabled(configuration.autocorrectionDisabled)
                    .textInputAutocapitalization(configuration.textInputAutocapitalization)
                    .keyboardType(configuration.keyboardType)
                    .accessibilityLabel(Text(configuration.label))
                    .reguertaOptionalAccessibilityIdentifier(configuration.accessibilityIdentifier)
            }
        }
        .frame(
            maxWidth: .infinity,
            minHeight: tokens.layout.minimumTouchTarget,
            alignment: .leading
        )
    }
}

private struct ReguertaInputTrailingIconView: View {
    @Environment(\.reguertaTokens) private var tokens

    let configuration: ReguertaInputFieldConfiguration

    var body: some View {
        if let trailingIcon = configuration.trailingIcon {
            if let onTrailingTap = configuration.onTrailingTap {
                Button(action: onTrailingTap) {
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

private struct ReguertaInputMessageView: View {
    @Environment(\.reguertaTokens) private var tokens

    let errorMessage: LocalizedStringKey?
    let helperMessage: LocalizedStringKey?

    var body: some View {
        if let errorMessage {
            Text(errorMessage)
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.feedbackError)
        } else if let helperMessage {
            Text(helperMessage)
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.textSecondary)
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

private extension View {
    @ViewBuilder func reguertaOptionalAccessibilityIdentifier(_ identifier: String?) -> some View {
        if let identifier {
            accessibilityIdentifier(identifier)
        } else {
            self
        }
    }
}
