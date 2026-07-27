import Foundation

enum AuthSignInFailureReason: Equatable, Sendable {
    case invalidEmail
    case invalidCredentials
    case emailAlreadyInUse
    case weakPassword
    case userNotFound
    case userDisabled
    case tooManyRequests
    case network
    case unknown
}

enum AuthSignInResult: Equatable, Sendable {
    case success(AuthPrincipal)
    case emailVerificationRequired(email: String, verificationResent: Bool, signedOut: Bool)
    case failure(AuthSignInFailureReason)
}

enum AuthSignUpResult: Equatable, Sendable {
    case verificationRequired(email: String, verificationSent: Bool, signedOut: Bool)
    case failure(AuthSignInFailureReason)
}

enum AuthPasswordResetResult: Equatable, Sendable {
    case success
    case failure(AuthSignInFailureReason)
}

enum AuthSessionRefreshResult: Equatable, Sendable {
    case noSession
    case active(AuthPrincipal)
    case emailVerificationRequired(email: String)
    case failure(AuthSignInFailureReason)
    case expired
}

@MainActor
protocol FirebaseIDTokenProviding {
    func validIDToken(forcingRefresh: Bool) async throws -> String
}

@MainActor
protocol AuthSessionProvider: FirebaseIDTokenProviding {
    func signIn(email: String, password: String) async -> AuthSignInResult
    func signUp(email: String, password: String) async -> AuthSignUpResult
    func sendPasswordReset(email: String) async -> AuthPasswordResetResult
    func sendCurrentUserEmailVerification() async -> Bool
    func refreshCurrentSession() async -> AuthSessionRefreshResult
    @discardableResult func signOut() -> Bool
}
