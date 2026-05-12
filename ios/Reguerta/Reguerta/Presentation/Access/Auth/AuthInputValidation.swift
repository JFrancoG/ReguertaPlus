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

func isValidAccessPassword(_ password: String) -> Bool {
    (6...16).contains(password.count)
}
