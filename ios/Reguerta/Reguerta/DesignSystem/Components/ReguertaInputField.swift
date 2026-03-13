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

    let label: LocalizedStringKey
    @Binding var text: String
    let placeholder: LocalizedStringKey?
    let helperMessage: LocalizedStringKey?
    let errorMessage: LocalizedStringKey?
    let isEnabled: Bool
    let isSecure: Bool
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
        isEnabled: Bool = true,
        isSecure: Bool = false,
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
        self.isEnabled = isEnabled
        self.isSecure = isSecure
        self.showsClearAction = showsClearAction
        self.showsPasswordToggle = showsPasswordToggle
        self.keyboardType = keyboardType
        self.trailingIcon = trailingIcon
        self.onTrailingTap = onTrailingTap
    }

    private var visualState: ReguertaInputState {
        if !isEnabled { return .disabled }
        if errorMessage != nil { return .error }
        if isFocused { return .focused }
        return .default
    }

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.xs) {
            Text(label)
                .font(tokens.typography.label)
                .foregroundStyle(labelColor(for: visualState))

            HStack(spacing: tokens.spacing.sm) {
                ZStack(alignment: .leading) {
                    if let placeholder {
                        Text(placeholder)
                            .font(tokens.typography.body)
                            .foregroundStyle(tokens.colors.textSecondary.opacity(0.65))
                            .opacity(text.isEmpty ? 1 : 0)
                    }
                    if isSecure && !isPasswordVisible {
                        SecureField("", text: $text)
                            .font(tokens.typography.body)
                            .disabled(!isEnabled)
                            .focused($isFocused)
                            .textInputAutocapitalization(.never)
                            .keyboardType(keyboardType)
                            .accessibilityLabel(Text(label))
                    } else {
                        TextField("", text: $text)
                            .font(tokens.typography.body)
                            .disabled(!isEnabled)
                            .focused($isFocused)
                            .textInputAutocapitalization(.never)
                            .keyboardType(keyboardType)
                            .accessibilityLabel(Text(label))
                    }
                }

                if isSecure && showsPasswordToggle {
                    Button {
                        isPasswordVisible.toggle()
                    } label: {
                        Image(systemName: isPasswordVisible ? "eye.slash.fill" : "eye.fill")
                            .foregroundStyle(tokens.colors.textSecondary)
                    }
                    .buttonStyle(.plain)
                    .disabled(!isEnabled)
                    .accessibilityLabel(Text(isPasswordVisible ? "common.action.hide_password" : "common.action.show_password"))
                }

                if showsClearAction && isEnabled && !text.isEmpty {
                    Button {
                        text = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(tokens.colors.textSecondary)
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
            .padding(.horizontal, tokens.spacing.md)
            .padding(.vertical, tokens.spacing.sm + 2)
            .background(tokens.colors.surfacePrimary)
            .overlay(
                RoundedRectangle(cornerRadius: tokens.radius.sm)
                    .stroke(borderColor(for: visualState), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))

            if let errorMessage {
                Text(errorMessage)
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.feedbackError)
            } else if let helperMessage {
                Text(helperMessage)
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
            }
        }
    }

    private func borderColor(for state: ReguertaInputState) -> Color {
        switch state {
        case .default:
            tokens.colors.borderSubtle
        case .focused:
            tokens.colors.actionPrimary
        case .error:
            tokens.colors.feedbackError
        case .disabled:
            tokens.colors.borderSubtle.opacity(0.5)
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
