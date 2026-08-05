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
            let principal = try await awaitFirebaseAuthenticationFlow {
                try await auth.signIn(withEmail: trimmedEmail, password: password)
            } continuation: { result in
                try await awaitFirebaseAuthenticationMutation {
                    try await result.user.reload()
                } signOut: {
                    signOut()
                }
                guard let refreshedUser = auth.currentUser else {
                    throw FirebaseIDTokenError.noAuthenticatedUser
                }
                _ = try await awaitFirebaseAuthenticationMutation {
                    try await refreshedUser.getIDTokenResult(forcingRefresh: true)
                } signOut: {
                    signOut()
                }
                return AuthPrincipal(
                    uid: refreshedUser.uid,
                    email: normalizedEmail(refreshedUser.email ?? trimmedEmail)
                )
            } signOut: {
                signOut()
            }
            return .success(principal)
        } catch let failure as FirebaseAuthenticationContinuationError {
            return .failureAfterAuthenticationMutation(
                reason: mapFirebaseAuthError(failure.underlyingError),
                signedOut: failure.signedOut
            )
        } catch {
            return .failure(mapFirebaseAuthError(error))
        }
    }

    func signUp(email: String, password: String) async -> AuthSignUpResult {
        let trimmedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)

        do {
            return try await awaitFirebaseAuthenticationFlow {
                try await auth.createUser(withEmail: trimmedEmail, password: password)
            } continuation: { result in
                let verificationSent = try await awaitFirebaseAuthenticationMutation {
                    await sendVerificationEmail(to: result.user)
                } signOut: {
                    signOut()
                }
                let signedOut = signOut()
                return .verificationRequired(
                    email: normalizedEmail(result.user.email ?? trimmedEmail),
                    verificationSent: verificationSent,
                    signedOut: signedOut
                )
            } signOut: {
                signOut()
            }
        } catch let failure as FirebaseAuthenticationContinuationError {
            return .failureAfterAuthenticationMutation(
                reason: mapFirebaseAuthError(failure.underlyingError),
                signedOut: failure.signedOut
            )
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

    func sendCurrentUserEmailVerification() async -> Bool {
        guard let user = auth.currentUser else { return false }
        return await sendVerificationEmail(to: user)
    }

    func refreshCurrentSession() async -> AuthSessionRefreshResult {
        guard let user = auth.currentUser else {
            return .noSession
        }

        do {
            return try await awaitFirebaseAuthenticationFlow {
                try await user.reload()
            } continuation: {
                guard let refreshedUser = auth.currentUser else {
                    return .expired
                }
                _ = try await awaitFirebaseAuthenticationMutation {
                    try await refreshedUser.getIDTokenResult(forcingRefresh: true)
                } signOut: {
                    signOut()
                }

                let principal = AuthPrincipal(
                    uid: refreshedUser.uid,
                    email: normalizedEmail(refreshedUser.email ?? "")
                )
                return .active(principal)
            } signOut: {
                signOut()
            }
        } catch let failure as FirebaseAuthenticationContinuationError {
            if isExpiredSessionError(failure.underlyingError) {
                return .expired
            }
            return .failureAfterAuthenticationMutation(
                reason: mapFirebaseAuthError(failure.underlyingError),
                signedOut: failure.signedOut
            )
        } catch {
            if isExpiredSessionError(error) {
                return .expired
            }
            return .failure(mapFirebaseAuthError(error))
        }
    }

    func validIDToken(forcingRefresh: Bool) async throws -> String {
        guard let user = auth.currentUser else {
            throw FirebaseIDTokenError.noAuthenticatedUser
        }
        try await user.reload()
        guard let refreshedUser = auth.currentUser else {
            throw FirebaseIDTokenError.noAuthenticatedUser
        }
        return try await refreshedUser.getIDTokenResult(forcingRefresh: forcingRefresh).token
    }

    @discardableResult func signOut() -> Bool {
        do {
            try auth.signOut()
            return true
        } catch {
            return false
        }
    }
}

@MainActor
func awaitFirebaseAuthenticationMutation<Value>(
    _ mutation: () async throws -> Value,
    signOut: () -> Bool
) async throws -> Value {
    do {
        let value = try await mutation()
        try Task.checkCancellation()
        return value
    } catch let error as CancellationError {
        throw FirebaseAuthenticationContinuationError(
            underlyingError: error,
            signedOut: signOut()
        )
    }
}

struct FirebaseAuthenticationContinuationError: Error {
    let underlyingError: any Error
    let signedOut: Bool
}

@MainActor
func awaitFirebaseAuthenticationFlow<MutationValue, ResultValue>(
    _ mutation: () async throws -> MutationValue,
    continuation: (MutationValue) async throws -> ResultValue,
    signOut: () -> Bool
) async throws -> ResultValue {
    let mutationValue = try await awaitFirebaseAuthenticationMutation(
        mutation,
        signOut: signOut
    )
    do {
        return try await continuation(mutationValue)
    } catch let failure as FirebaseAuthenticationContinuationError {
        throw failure
    } catch let error as CancellationError {
        throw FirebaseAuthenticationContinuationError(
            underlyingError: error,
            signedOut: signOut()
        )
    } catch {
        throw FirebaseAuthenticationContinuationError(
            underlyingError: error,
            signedOut: signOut()
        )
    }
}

private enum FirebaseIDTokenError: Error {
    case noAuthenticatedUser
}

@MainActor private func sendVerificationEmail(to user: User) async -> Bool {
    do {
        try await user.sendEmailVerification()
        return true
    } catch {
        return false
    }
}

private func normalizedEmail(_ email: String) -> String {
    email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
}

@MainActor func mapFirebaseAuthError(_ error: Error) -> AuthSignInFailureReason {
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

@MainActor private func isExpiredSessionError(_ error: Error) -> Bool {
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
