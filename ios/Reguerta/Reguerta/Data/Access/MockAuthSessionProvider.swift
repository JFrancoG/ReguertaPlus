import Foundation

@MainActor
final class MockAuthSessionProvider: AuthSessionProvider {
    private var currentPrincipal: AuthPrincipal?

    func signIn(email: String, password: String) async -> AuthSignInResult {
        guard password == "test1234" else {
            return .failure(.invalidCredentials)
        }

        let principal = buildPrincipal(from: email)
        currentPrincipal = principal
        return .success(principal)
    }

    func signUp(email: String, password: String) async -> AuthSignInResult {
        if !(6...16).contains(password.count) {
            return .failure(.weakPassword)
        }

        let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if normalizedEmail.contains("exists") {
            return .failure(.emailAlreadyInUse)
        }

        let principal = buildPrincipal(from: email)
        currentPrincipal = principal
        return .success(principal)
    }

    func sendPasswordReset(email: String) async -> AuthPasswordResetResult {
        let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard normalizedEmail.contains("@"), normalizedEmail.contains(".") else {
            return .failure(.invalidEmail)
        }
        return .success
    }

    func refreshCurrentSession() async -> AuthSessionRefreshResult {
        guard let currentPrincipal else {
            return .noSession
        }
        return .active(currentPrincipal)
    }

    func signOut() {
        currentPrincipal = nil
    }

    private func buildPrincipal(from email: String) -> AuthPrincipal {
        let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let uidSuffix = normalizedEmail
            .replacingOccurrences(of: "[^a-z0-9]+", with: "_", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "_"))
        let uid = "mock_\(uidSuffix.isEmpty ? "user" : uidSuffix)"
        return AuthPrincipal(uid: uid, email: normalizedEmail)
    }
}
