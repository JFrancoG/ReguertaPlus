import SwiftUI

struct ReguertaInputTextEntryView: View {
    @Environment(\.reguertaTokens) private var tokens
    @Binding var text: String
    var isFocused: FocusState<Bool>.Binding

    let passwordVisibility: Bool
    let errorMessage: LocalizedStringKey?
    let configuration: ReguertaInputFieldConfiguration

    var body: some View {
        ZStack(alignment: .leading) {
            if let placeholder = configuration.placeholder {
                Text(placeholder)
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary.opacity(0.65))
                    .opacity(text.isEmpty ? 1 : 0)
                    .accessibilityHidden(true)
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
                    .textContentType(configuration.textContentType)
                    .accessibilityLabel(Text(configuration.label))
                    .reguertaAccessibilityError(errorMessage)
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
                    .textContentType(configuration.textContentType)
                    .accessibilityLabel(Text(configuration.label))
                    .reguertaAccessibilityError(errorMessage)
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
                    .textContentType(configuration.textContentType)
                    .accessibilityLabel(Text(configuration.label))
                    .reguertaAccessibilityError(errorMessage)
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

private struct ReguertaInputAccessibilityErrorModifier: ViewModifier {
    let errorMessage: LocalizedStringKey?

    func body(content: Content) -> some View {
        content.accessibilityCustomContent(
            AccessibilityCustomContentKey(LocalizedStringKey(AccessL10nKey.commonAccessibilityError)),
            errorMessage.map { Text($0) },
            importance: .high
        )
    }
}

private extension View {
    func reguertaAccessibilityError(_ errorMessage: LocalizedStringKey?) -> some View {
        modifier(ReguertaInputAccessibilityErrorModifier(errorMessage: errorMessage))
    }

    @ViewBuilder func reguertaOptionalAccessibilityIdentifier(_ identifier: String?) -> some View {
        if let identifier {
            accessibilityIdentifier(identifier)
        } else {
            self
        }
    }
}

#Preview(
    "Input text entry · error · AX5",
    traits: .modifier(ReguertaDesignSystemPreviewModifier(fixture: .inputAccessibility)),
    .fixedLayout(width: 320, height: 720)
) {
    @Previewable @State var text = "invalid"
    @Previewable @FocusState var isFocused: Bool

    ReguertaInputTextEntryView(
        text: $text,
        isFocused: $isFocused,
        passwordVisibility: false,
        errorMessage: LocalizedStringKey(AccessL10nKey.feedbackEmailInvalid),
        configuration: ReguertaInputFieldConfiguration(
            label: "Email",
            placeholder: "name@example.com",
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
            keyboardType: .emailAddress,
            textContentType: .emailAddress,
            trailingIcon: nil,
            onTrailingTap: nil,
            accessibilityIdentifier: "preview.input.textEntry",
            isMultiline: false,
            textInputAutocapitalization: .never,
            autocorrectionDisabled: true
        )
    )
    .padding()
}
