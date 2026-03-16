import Foundation

struct MockAuthSessionProvider: AuthSessionProvider {
    func signIn(email: String, password: String) async -> AuthSignInResult {
        guard password == "test1234" else {
            return .failure(.invalidCredentials)
        }

        let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let uidSuffix = normalizedEmail
            .replacingOccurrences(of: "[^a-z0-9]+", with: "_", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "_"))
        let uid = "mock_\(uidSuffix.isEmpty ? "user" : uidSuffix)"

        return .success(AuthPrincipal(uid: uid, email: normalizedEmail))
    }

    func signUp(email: String, password: String) async -> AuthSignInResult {
        if !password.isValidMockPassword {
            return .failure(.weakPassword)
        }

        let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if normalizedEmail.contains("exists") {
            return .failure(.emailAlreadyInUse)
        }
        let uidSuffix = normalizedEmail
            .replacingOccurrences(of: "[^a-z0-9]+", with: "_", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "_"))
        let uid = "mock_\(uidSuffix.isEmpty ? "user" : uidSuffix)"

        return .success(AuthPrincipal(uid: uid, email: normalizedEmail))
    }

    func sendPasswordReset(email: String) async -> AuthPasswordResetResult {
        let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard normalizedEmail.contains("@"), normalizedEmail.contains(".") else {
            return .failure(.invalidEmail)
        }
        return .success
    }

    func signOut() {
    }
}

private extension String {
    var isValidMockPassword: Bool {
        (6...16).contains(count)
    }
}
