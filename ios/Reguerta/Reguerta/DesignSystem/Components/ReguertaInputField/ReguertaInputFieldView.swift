import SwiftUI

struct ReguertaInputFieldView: View {
    @Environment(\.reguertaTokens) private var tokens
    @FocusState private var isFocused: Bool
    @Binding var text: String
    @State private var isPasswordVisible = false
    @State private var hasInteracted = false

    let viewModel: ReguertaInputFieldViewModel

    private var effectiveErrorMessage: LocalizedStringKey? {
        viewModel.effectiveErrorMessage(text: text, hasInteracted: hasInteracted)
    }

    private var visualState: ReguertaInputState {
        viewModel.visualState(text: text, hasInteracted: hasInteracted, isFocused: isFocused)
    }

    private var passwordVisibility: Bool {
        viewModel.passwordVisibility(isPasswordVisible: isPasswordVisible)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.xs) {
            Text(viewModel.label)
                .font(tokens.typography.label)
                .textCase(.uppercase)
                .foregroundStyle(viewModel.labelColor(for: visualState, tokens: tokens))

            HStack(spacing: tokens.spacing.sm) {
                ReguertaInputTextEntryView(
                    text: $text,
                    isFocused: $isFocused,
                    passwordVisibility: passwordVisibility,
                    viewModel: viewModel
                )

                if viewModel.isSecure && viewModel.showsPasswordToggle {
                    Button(action: togglePasswordVisibility) {
                        Image(systemName: passwordVisibility ? "eye.slash" : "eye")
                            .foregroundStyle(tokens.colors.textSecondary)
                            .frame(width: 24.resize, height: 24.resize)
                    }
                    .buttonStyle(.plain)
                    .disabled(!viewModel.isEnabled)
                    .accessibilityLabel(Text(passwordVisibility ? "common.action.hide_password" : "common.action.show_password"))
                }

                if viewModel.showsClearAction && viewModel.isEnabled && !text.isEmpty {
                    Button(action: clearText) {
                        Image(systemName: "xmark")
                            .foregroundStyle(tokens.colors.textSecondary)
                            .frame(width: 24.resize, height: 24.resize)
                            .offset(x: -1.resize)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(Text("common.action.clear"))
                }

                ReguertaInputTrailingIconView(viewModel: viewModel)
            }
            .padding(.vertical, tokens.spacing.xs)

            Rectangle()
                .fill(viewModel.lineColor(for: visualState, tokens: tokens))
                .frame(height: 1)

            ReguertaInputMessageView(
                errorMessage: effectiveErrorMessage,
                helperMessage: viewModel.helperMessage
            )
        }
        .onChange(of: isFocused, updateInteractionState)
    }

    private func togglePasswordVisibility() {
        if let sharedPasswordVisibility = viewModel.sharedPasswordVisibility {
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
    let viewModel: ReguertaInputFieldViewModel

    var body: some View {
        ZStack(alignment: .leading) {
            if let placeholder = viewModel.placeholder {
                Text(placeholder)
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary.opacity(0.65))
                    .opacity(text.isEmpty ? 1 : 0)
            }
            if viewModel.isSecure && !passwordVisibility {
                SecureField("", text: $text)
                    .font(tokens.typography.body)
                    .disabled(!viewModel.isEnabled)
                    .allowsHitTesting(!viewModel.isReadOnly)
                    .focused(isFocused)
                    .autocorrectionDisabled(viewModel.autocorrectionDisabled)
                    .textInputAutocapitalization(viewModel.textInputAutocapitalization)
                    .keyboardType(viewModel.keyboardType)
                    .accessibilityLabel(Text(viewModel.label))
                    .reguertaOptionalAccessibilityIdentifier(viewModel.accessibilityIdentifier)
            } else if viewModel.isMultiline {
                TextField("", text: $text, axis: .vertical)
                    .font(tokens.typography.body)
                    .lineLimit(3...6)
                    .disabled(!viewModel.isEnabled)
                    .allowsHitTesting(!viewModel.isReadOnly)
                    .focused(isFocused)
                    .autocorrectionDisabled(viewModel.autocorrectionDisabled)
                    .textInputAutocapitalization(viewModel.textInputAutocapitalization)
                    .keyboardType(viewModel.keyboardType)
                    .accessibilityLabel(Text(viewModel.label))
                    .reguertaOptionalAccessibilityIdentifier(viewModel.accessibilityIdentifier)
            } else {
                TextField("", text: $text)
                    .font(tokens.typography.body)
                    .disabled(!viewModel.isEnabled)
                    .allowsHitTesting(!viewModel.isReadOnly)
                    .focused(isFocused)
                    .autocorrectionDisabled(viewModel.autocorrectionDisabled)
                    .textInputAutocapitalization(viewModel.textInputAutocapitalization)
                    .keyboardType(viewModel.keyboardType)
                    .accessibilityLabel(Text(viewModel.label))
                    .reguertaOptionalAccessibilityIdentifier(viewModel.accessibilityIdentifier)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct ReguertaInputTrailingIconView: View {
    @Environment(\.reguertaTokens) private var tokens

    let viewModel: ReguertaInputFieldViewModel

    var body: some View {
        if let trailingIcon = viewModel.trailingIcon {
            if let onTrailingTap = viewModel.onTrailingTap {
                Button(action: onTrailingTap) {
                    trailingIcon
                        .foregroundStyle(tokens.colors.textSecondary)
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

#Preview("ReguertaInputField") {
    @Previewable @State var text = ""

    VStack(spacing: 20) {
        reguertaInputField(
            "Email",
            text: $text,
            placeholder: "name@example.com",
            helperMessage: "Helper message",
            showsClearAction: true
        )
        reguertaInputField(
            "Password",
            text: $text,
            placeholder: "Password",
            isSecure: true
        )
    }
    .padding()
}

private extension View {
    @ViewBuilder
    func reguertaOptionalAccessibilityIdentifier(_ identifier: String?) -> some View {
        if let identifier {
            accessibilityIdentifier(identifier)
        } else {
            self
        }
    }
}
