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
    case failure(AuthSignInFailureReason)
}

enum AuthPasswordResetResult: Equatable, Sendable {
    case success
    case failure(AuthSignInFailureReason)
}

enum AuthSessionRefreshResult: Equatable, Sendable {
    case noSession
    case active(AuthPrincipal)
    case expired
}

@MainActor
protocol AuthSessionProvider {
    func signIn(email: String, password: String) async -> AuthSignInResult
    func signUp(email: String, password: String) async -> AuthSignInResult
    func sendPasswordReset(email: String) async -> AuthPasswordResetResult
    func refreshCurrentSession() async -> AuthSessionRefreshResult
    func signOut()
}
