import Foundation

func normalizeAccessEmail(_ email: String) -> String {
    email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
}

func isValidAccessEmail(_ email: String) -> Bool {
    email.range(
        of: "^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$",
        options: [.regularExpression, .caseInsensitive]
    ) != nil
}

func isValidAccessPassword(_ password: String) -> Bool { (6...16).contains(password.count) }

func isValidNormalizedAccessEmailInput(_ email: String) -> Bool {
    isValidAccessEmail(normalizeAccessEmail(email))
}

func accessRepeatedPasswordErrorKey(password: String, repeatedPassword: String) -> String? {
    if repeatedPassword.isEmpty { return AccessL10nKey.feedbackPasswordRepeatRequired }
    if !isValidAccessPassword(repeatedPassword) { return AccessL10nKey.authErrorWeakPassword }
    if repeatedPassword != password { return AccessL10nKey.feedbackPasswordMismatch }
    return nil
}

extension SessionViewModel {
    func registerRepeatedPasswordValidationMessage(_ candidate: String) -> String? {
        accessRepeatedPasswordErrorKey(password: registerPasswordInput, repeatedPassword: candidate)
    }
}
