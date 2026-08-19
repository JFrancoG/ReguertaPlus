import FirebaseAuth
import Foundation

@MainActor
struct FirebaseAuthSessionProvider: AuthSessionProvider {
    private let storedAuth: Auth

    func signIn(email: String, password: String) async -> AuthSignInResult {
        let trimmedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)

        do {
            let principal = try await awaitFirebaseAuthenticationFlow {
                try await storedAuth.signIn(withEmail: trimmedEmail, password: password)
            } continuation: { result in
                let authenticatedUID = result.user.uid
                try await awaitFirebaseAuthenticationMutation {
                    try await reloadFirebaseUser(result.user)
                } signOut: {
                    signOut()
                }
                guard let refreshedUser = storedAuth.currentUser,
                      refreshedUser.uid == authenticatedUID else {
                    throw FirebaseIDTokenError.noAuthenticatedUser
                }
                _ = try await awaitFirebaseAuthenticationMutation {
                    try await firebaseIDToken(for: refreshedUser, forcingRefresh: true)
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
                try await storedAuth.createUser(withEmail: trimmedEmail, password: password)
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
            try await storedAuth.sendPasswordReset(withEmail: trimmedEmail)
            return .success
        } catch {
            return .failure(mapFirebaseAuthError(error))
        }
    }

    func sendCurrentUserEmailVerification() async -> Bool {
        guard let user = storedAuth.currentUser else { return false }
        return await awaitFirebaseBooleanCallback {
            await sendVerificationEmail(to: user)
        }
    }

    func refreshCurrentSession() async -> AuthSessionRefreshResult {
        guard let user = storedAuth.currentUser else { return .noSession }
        let authenticatedUID = user.uid

        do {
            return try await awaitFirebaseAuthenticationFlow {
                try await reloadFirebaseUser(user)
            } continuation: {
                guard let refreshedUser = storedAuth.currentUser,
                      refreshedUser.uid == authenticatedUID else {
                    return .expired
                }
                _ = try await awaitFirebaseAuthenticationMutation {
                    try await firebaseIDToken(for: refreshedUser, forcingRefresh: true)
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
        guard let user = storedAuth.currentUser else { throw IDTokenProviderError.noAuthenticatedUser }
        let authenticatedUID = user.uid
        do {
            try await awaitFirebaseCallback {
                try await reloadFirebaseUser(user)
            }
            guard let refreshedUser = storedAuth.currentUser,
                  refreshedUser.uid == authenticatedUID else {
                throw IDTokenProviderError.noAuthenticatedUser
            }
            return try await awaitFirebaseCallback {
                try await firebaseIDToken(for: refreshedUser, forcingRefresh: forcingRefresh)
            }
        } catch is CancellationError {
            throw CancellationError()
        } catch let error as IDTokenProviderError {
            throw error
        } catch {
            throw IDTokenProviderError.unavailable
        }
    }

    @discardableResult func signOut() -> Bool {
        do {
            try storedAuth.signOut()
            return true
        } catch {
            return false
        }
    }
}

extension FirebaseAuthSessionProvider {
    init(auth: Auth = Auth.auth()) {
        self.storedAuth = auth
    }
}

@MainActor
func awaitFirebaseCallback<Value>(_ operation: () async throws -> Value) async throws -> Value {
    let value = try await operation()
    try Task.checkCancellation()
    return value
}

@MainActor
func awaitFirebaseBooleanCallback(_ operation: () async -> Bool) async -> Bool {
    do {
        return try await awaitFirebaseCallback(operation)
    } catch {
        return false
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
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            user.sendEmailVerification { error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: ())
                }
            }
        }
        return true
    } catch {
        return false
    }
}

@MainActor private func reloadFirebaseUser(_ user: User) async throws {
    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
        user.reload { error in
            if let error {
                continuation.resume(throwing: error)
            } else {
                continuation.resume(returning: ())
            }
        }
    }
}

@MainActor private func firebaseIDToken(for user: User, forcingRefresh: Bool) async throws -> String {
    try await withCheckedThrowingContinuation { continuation in
        user.getIDTokenResult(forcingRefresh: forcingRefresh) { result, error in
            if let error {
                continuation.resume(throwing: error)
            } else if let result {
                continuation.resume(returning: result.token)
            } else {
                continuation.resume(throwing: FirebaseIDTokenError.noAuthenticatedUser)
            }
        }
    }
}

private func normalizedEmail(_ email: String) -> String {
    email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
}

@MainActor func mapFirebaseAuthError(_ error: Error) -> AuthSignInFailureReason {
    let nsError = error as NSError
    guard let code = AuthErrorCode(rawValue: nsError.code) else { return .unknown }

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
    guard let code = AuthErrorCode(rawValue: nsError.code) else { return false }

    switch code {
    case .userDisabled, .userNotFound, .invalidCredential, .userTokenExpired, .invalidUserToken:
        return true
    default:
        return false
    }
}
