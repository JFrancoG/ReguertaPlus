import FirebaseAuth
import Foundation

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

    func signOut() {
        try? auth.signOut()
    }
}

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
