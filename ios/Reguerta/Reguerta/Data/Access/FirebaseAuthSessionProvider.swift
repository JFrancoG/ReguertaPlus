import FirebaseAuth
import Foundation

extension User: @retroactive @unchecked Sendable {}

struct FirebaseAuthSessionProvider: AuthSessionProvider {
    private let auth: Auth

    init(auth: Auth = Auth.auth()) {
        self.auth = auth
    }

    func signIn(email: String, password: String) async -> AuthSignInResult {
        let trimmedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)

        do {
            let result = try await auth.signIn(withEmail: trimmedEmail, password: password)
            let principal = AuthPrincipal(
                uid: result.user.uid,
                email: (result.user.email ?? trimmedEmail).trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            )
            return .success(principal)
        } catch {
            return .failure(mapFirebaseAuthError(error))
        }
    }

    func signUp(email: String, password: String) async -> AuthSignInResult {
        let trimmedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)

        do {
            let result = try await auth.createUser(withEmail: trimmedEmail, password: password)
            let principal = AuthPrincipal(
                uid: result.user.uid,
                email: (result.user.email ?? trimmedEmail).trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            )
            return .success(principal)
        } catch {
            return .failure(mapFirebaseAuthError(error))
        }
    }

    func sendPasswordReset(email: String) async -> AuthPasswordResetResult {
        let trimmedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)

        do {
            try await auth.sendPasswordReset(withEmail: trimmedEmail)
            return .success
        } catch {
            return .failure(mapFirebaseAuthError(error))
        }
    }

    func refreshCurrentSession() async -> AuthSessionRefreshResult {
        guard let user = auth.currentUser else {
            return .noSession
        }

        let fallbackPrincipal = AuthPrincipal(
            uid: user.uid,
            email: (user.email ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        )

        do {
            try await user.reload()
            guard let refreshedUser = auth.currentUser else {
                return .expired
            }
            _ = try await refreshedUser.getIDTokenResult(forcingRefresh: false)

            let principal = AuthPrincipal(
                uid: refreshedUser.uid,
                email: (refreshedUser.email ?? fallbackPrincipal.email)
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                    .lowercased()
            )
            return .active(principal)
        } catch {
            if isExpiredSessionError(error) {
                try? auth.signOut()
                return .expired
            }
            return .active(fallbackPrincipal)
        }
    }

    func signOut() {
        try? auth.signOut()
    }
}

@MainActor
func mapFirebaseAuthError(_ error: Error) -> AuthSignInFailureReason {
    let nsError = error as NSError
    guard let code = AuthErrorCode(rawValue: nsError.code) else {
        return .unknown
    }

    switch code {
    case .invalidEmail:
        return .invalidEmail
    case .wrongPassword, .invalidCredential:
        return .invalidCredentials
    case .emailAlreadyInUse:
        return .emailAlreadyInUse
    case .weakPassword:
        return .weakPassword
    case .userNotFound:
        return .userNotFound
    case .userDisabled:
        return .userDisabled
    case .tooManyRequests:
        return .tooManyRequests
    case .networkError:
        return .network
    default:
        return .unknown
    }
}

@MainActor
private func isExpiredSessionError(_ error: Error) -> Bool {
    let nsError = error as NSError
    guard let code = AuthErrorCode(rawValue: nsError.code) else {
        return false
    }

    switch code {
    case .userDisabled, .userNotFound, .invalidCredential, .userTokenExpired, .invalidUserToken:
        return true
    default:
        return false
    }
}
