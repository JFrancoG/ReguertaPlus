import Foundation

enum AuthSignInFailureReason: Equatable, Sendable {
    case invalidEmail
    case invalidCredentials
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

protocol AuthSessionProvider: Sendable {
    func signIn(email: String, password: String) async -> AuthSignInResult
    func signOut()
}
