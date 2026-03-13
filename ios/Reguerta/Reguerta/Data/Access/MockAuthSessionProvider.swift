import Foundation

struct MockAuthSessionProvider: AuthSessionProvider {
    func signIn(email: String, password: String) async -> AuthSignInResult {
        let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let uidSuffix = normalizedEmail
            .replacingOccurrences(of: "[^a-z0-9]+", with: "_", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "_"))
        let uid = "mock_\(uidSuffix.isEmpty ? "user" : uidSuffix)"

        return .success(AuthPrincipal(uid: uid, email: normalizedEmail))
    }

    func signUp(email: String, password: String) async -> AuthSignInResult {
        let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let uidSuffix = normalizedEmail
            .replacingOccurrences(of: "[^a-z0-9]+", with: "_", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "_"))
        let uid = "mock_\(uidSuffix.isEmpty ? "user" : uidSuffix)"

        return .success(AuthPrincipal(uid: uid, email: normalizedEmail))
    }

    func sendPasswordReset(email: String) async -> AuthPasswordResetResult {
        .success
    }

    func signOut() {
    }
}
