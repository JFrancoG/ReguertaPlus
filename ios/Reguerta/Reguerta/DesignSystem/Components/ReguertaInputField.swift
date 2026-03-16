import SwiftUI

enum ReguertaInputState {
    case `default`
    case focused
    case error
    case disabled
}

struct ReguertaInputField: View {
    @Environment(\.reguertaTokens) private var tokens
    @FocusState private var isFocused: Bool
    @State private var isPasswordVisible = false
    @State private var hasInteracted = false

    let label: LocalizedStringKey
    @Binding var text: String
    let placeholder: LocalizedStringKey?
    let helperMessage: LocalizedStringKey?
    let errorMessage: LocalizedStringKey?
    let liveValidationMessage: LocalizedStringKey?
    let liveValidation: ((String) -> Bool)?
    let liveValidationMessageProvider: ((String) -> LocalizedStringKey?)?
    let isEnabled: Bool
    let isSecure: Bool
    let sharedPasswordVisibility: Binding<Bool>?
    let showsClearAction: Bool
    let showsPasswordToggle: Bool
    let keyboardType: UIKeyboardType
    let trailingIcon: Image?
    let onTrailingTap: (() -> Void)?

    init(
        _ label: LocalizedStringKey,
        text: Binding<String>,
        placeholder: LocalizedStringKey? = nil,
        helperMessage: LocalizedStringKey? = nil,
        errorMessage: LocalizedStringKey? = nil,
        liveValidationMessage: LocalizedStringKey? = nil,
        liveValidation: ((String) -> Bool)? = nil,
        liveValidationMessageProvider: ((String) -> LocalizedStringKey?)? = nil,
        isEnabled: Bool = true,
        isSecure: Bool = false,
        sharedPasswordVisibility: Binding<Bool>? = nil,
        showsClearAction: Bool = false,
        showsPasswordToggle: Bool = true,
        keyboardType: UIKeyboardType = .default,
        trailingIcon: Image? = nil,
        onTrailingTap: (() -> Void)? = nil
    ) {
        self.label = label
        self._text = text
        self.placeholder = placeholder
        self.helperMessage = helperMessage
        self.errorMessage = errorMessage
        self.liveValidationMessage = liveValidationMessage
        self.liveValidation = liveValidation
        self.liveValidationMessageProvider = liveValidationMessageProvider
        self.isEnabled = isEnabled
        self.isSecure = isSecure
        self.sharedPasswordVisibility = sharedPasswordVisibility
        self.showsClearAction = showsClearAction
        self.showsPasswordToggle = showsPasswordToggle
        self.keyboardType = keyboardType
        self.trailingIcon = trailingIcon
        self.onTrailingTap = onTrailingTap
    }

    private var effectiveErrorMessage: LocalizedStringKey? {
        if let errorMessage { return errorMessage }
        guard hasInteracted else { return nil }

        if let liveValidationMessageProvider {
            return liveValidationMessageProvider(text)
        }

        guard let liveValidation, let liveValidationMessage else { return nil }
        return liveValidation(text) ? nil : liveValidationMessage
    }

    private var visualState: ReguertaInputState {
        if !isEnabled { return .disabled }
        if effectiveErrorMessage != nil { return .error }
        if isFocused { return .focused }
        return .default
    }

    private var passwordVisibility: Bool {
        sharedPasswordVisibility?.wrappedValue ?? isPasswordVisible
    }

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.xs) {
            Text(label)
                .font(tokens.typography.label)
                .textCase(.uppercase)
                .foregroundStyle(labelColor(for: visualState))

            HStack(spacing: tokens.spacing.sm) {
                ZStack(alignment: .leading) {
                    if let placeholder {
                        Text(placeholder)
                            .font(tokens.typography.bodySecondary)
                            .foregroundStyle(tokens.colors.textSecondary.opacity(0.65))
                            .opacity(text.isEmpty ? 1 : 0)
                    }
                    if isSecure && !passwordVisibility {
                        SecureField("", text: $text)
                            .font(tokens.typography.body)
                            .disabled(!isEnabled)
                            .focused($isFocused)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                            .keyboardType(keyboardType)
                            .accessibilityLabel(Text(label))
                    } else {
                        TextField("", text: $text)
                            .font(tokens.typography.body)
                            .disabled(!isEnabled)
                            .focused($isFocused)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                            .keyboardType(keyboardType)
                            .accessibilityLabel(Text(label))
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                if isSecure && showsPasswordToggle {
                    Button {
                        togglePasswordVisibility()
                    } label: {
                        Image(systemName: passwordVisibility ? "eye.slash" : "eye")
                            .foregroundStyle(tokens.colors.textSecondary)
                            .frame(width: 24.resize, height: 24.resize)
                    }
                    .buttonStyle(.plain)
                    .disabled(!isEnabled)
                    .accessibilityLabel(Text(passwordVisibility ? "common.action.hide_password" : "common.action.show_password"))
                }

                if showsClearAction && isEnabled && !text.isEmpty {
                    Button {
                        text = ""
                    } label: {
                        Image(systemName: "xmark")
                            .foregroundStyle(tokens.colors.textSecondary)
                            .frame(width: 24.resize, height: 24.resize)
                            .offset(x: -1.resize)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(Text("common.action.clear"))
                }

                if let trailingIcon {
                    if let onTrailingTap {
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
            .padding(.vertical, tokens.spacing.xs)

            Rectangle()
                .fill(lineColor(for: visualState))
                .frame(height: 1)

            if let effectiveErrorMessage {
                Text(effectiveErrorMessage)
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.feedbackError)
            } else if let helperMessage {
                Text(helperMessage)
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
            }
        }
        .onChange(of: isFocused) { _, focused in
            if focused {
                hasInteracted = true
            }
        }
    }

    private func togglePasswordVisibility() {
        if let sharedPasswordVisibility {
            sharedPasswordVisibility.wrappedValue.toggle()
            return
        }
        isPasswordVisible.toggle()
    }

    private func lineColor(for state: ReguertaInputState) -> Color {
        switch state {
        case .default:
            tokens.colors.textSecondary
        case .focused:
            tokens.colors.actionPrimary
        case .error:
            tokens.colors.feedbackError
        case .disabled:
            tokens.colors.borderSubtle.opacity(0.6)
        }
    }

    private func labelColor(for state: ReguertaInputState) -> Color {
        switch state {
        case .focused:
            tokens.colors.actionPrimary
        case .error:
            tokens.colors.feedbackError
        case .default, .disabled:
            tokens.colors.textSecondary
        }
    }
}
