import SwiftUI

enum ReguertaInputState {
    case `default`
    case focused
    case error
    case disabled
}

struct ReguertaInputFieldViewModel {
    let label: LocalizedStringKey
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
    let accessibilityIdentifier: String?

    func effectiveErrorMessage(text: String, hasInteracted: Bool) -> LocalizedStringKey? {
        if let errorMessage { return errorMessage }
        guard hasInteracted else { return nil }

        if let liveValidationMessageProvider {
            return liveValidationMessageProvider(text)
        }

        guard let liveValidation, let liveValidationMessage else { return nil }
        return liveValidation(text) ? nil : liveValidationMessage
    }

    func visualState(text: String, hasInteracted: Bool, isFocused: Bool) -> ReguertaInputState {
        if !isEnabled { return .disabled }
        if effectiveErrorMessage(text: text, hasInteracted: hasInteracted) != nil { return .error }
        if isFocused { return .focused }
        return .default
    }

    func passwordVisibility(isPasswordVisible: Bool) -> Bool {
        sharedPasswordVisibility?.wrappedValue ?? isPasswordVisible
    }

    func lineColor(for state: ReguertaInputState, tokens: ReguertaDesignTokens) -> Color {
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

    func labelColor(for state: ReguertaInputState, tokens: ReguertaDesignTokens) -> Color {
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

@ViewBuilder
func reguertaInputField(
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
    onTrailingTap: (() -> Void)? = nil,
    accessibilityIdentifier: String? = nil
) -> some View {
    ReguertaInputFieldView(
        text: text,
        viewModel: ReguertaInputFieldViewModel(
            label: label,
            placeholder: placeholder,
            helperMessage: helperMessage,
            errorMessage: errorMessage,
            liveValidationMessage: liveValidationMessage,
            liveValidation: liveValidation,
            liveValidationMessageProvider: liveValidationMessageProvider,
            isEnabled: isEnabled,
            isSecure: isSecure,
            sharedPasswordVisibility: sharedPasswordVisibility,
            showsClearAction: showsClearAction,
            showsPasswordToggle: showsPasswordToggle,
            keyboardType: keyboardType,
            trailingIcon: trailingIcon,
            onTrailingTap: onTrailingTap,
            accessibilityIdentifier: accessibilityIdentifier
        )
    )
}
