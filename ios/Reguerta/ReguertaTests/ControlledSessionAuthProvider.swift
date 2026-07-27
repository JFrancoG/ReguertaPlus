import Testing

@testable import Reguerta

@MainActor
final class ControlledSessionAuthProvider: AuthSessionProvider {
    enum Event: Equatable {
        case signInStarted(Int)
        case signInCompleted(Int)
        case signOut
    }

    private let immediateSignInResult: AuthSignInResult?
    private let immediateRefreshResult: AuthSessionRefreshResult?
    private var signInContinuations: [CheckedContinuation<AuthSignInResult, Never>?] = []
    private var refreshContinuations: [CheckedContinuation<AuthSessionRefreshResult, Never>?] = []
    private(set) var signInRequestCount = 0
    private(set) var refreshRequestCount = 0
    private(set) var signOutCallCount = 0
    private(set) var isAuthenticated: Bool
    private(set) var events: [Event] = []

    init(
        signInResult: AuthSignInResult? = nil,
        refreshResult: AuthSessionRefreshResult? = nil,
        isAuthenticated: Bool = false
    ) {
        immediateSignInResult = signInResult
        immediateRefreshResult = refreshResult
        self.isAuthenticated = isAuthenticated
    }

    func signIn(email _: String, password _: String) async -> AuthSignInResult {
        let requestIndex = signInRequestCount
        signInRequestCount += 1
        events.append(.signInStarted(requestIndex))
        if let immediateSignInResult {
            applyAuthenticationState(for: immediateSignInResult)
            events.append(.signInCompleted(requestIndex))
            return immediateSignInResult
        }
        let result = await withCheckedContinuation { continuation in
            signInContinuations.append(continuation)
        }
        applyAuthenticationState(for: result)
        events.append(.signInCompleted(requestIndex))
        return result
    }

    func signUp(email _: String, password _: String) async -> AuthSignUpResult {
        .failure(.unknown)
    }

    func sendPasswordReset(email _: String) async -> AuthPasswordResetResult {
        .failure(.unknown)
    }

    func sendCurrentUserEmailVerification() async -> Bool {
        false
    }

    func validIDToken(forcingRefresh _: Bool) async throws -> String {
        "test-token"
    }

    func refreshCurrentSession() async -> AuthSessionRefreshResult {
        refreshRequestCount += 1
        if let immediateRefreshResult {
            applyAuthenticationState(for: immediateRefreshResult)
            return immediateRefreshResult
        }
        let result = await withCheckedContinuation { continuation in
            refreshContinuations.append(continuation)
        }
        applyAuthenticationState(for: result)
        return result
    }

    @discardableResult
    func signOut() -> Bool {
        signOutCallCount += 1
        isAuthenticated = false
        events.append(.signOut)
        return true
    }

    func waitForSignInRequestCount(_ expectedCount: Int) async -> Bool {
        for _ in 0 ..< 1_000 {
            if signInRequestCount >= expectedCount {
                return true
            }
            await Task.yield()
        }
        Issue.record("No se iniciaron \(expectedCount) peticiones de login")
        return false
    }

    func waitForRefreshRequestCount(_ expectedCount: Int) async -> Bool {
        for _ in 0 ..< 1_000 {
            if refreshRequestCount >= expectedCount {
                return true
            }
            await Task.yield()
        }
        Issue.record("No se iniciaron \(expectedCount) peticiones de refresh")
        return false
    }

    func completeSignIn(at index: Int = 0, with result: AuthSignInResult) {
        guard signInContinuations.indices.contains(index),
              let continuation = signInContinuations[index] else {
            Issue.record("No existe la petición de login \(index)")
            return
        }
        signInContinuations[index] = nil
        continuation.resume(returning: result)
    }

    func completeRefresh(at index: Int = 0, with result: AuthSessionRefreshResult) {
        guard refreshContinuations.indices.contains(index),
              let continuation = refreshContinuations[index] else {
            Issue.record("No existe la petición de refresh \(index)")
            return
        }
        refreshContinuations[index] = nil
        continuation.resume(returning: result)
    }

    private func applyAuthenticationState(for result: AuthSignInResult) {
        switch result {
        case .success:
            isAuthenticated = true
        case .emailVerificationRequired(_, _, let signedOut):
            isAuthenticated = !signedOut
        case .failure:
            break
        }
    }

    private func applyAuthenticationState(for result: AuthSessionRefreshResult) {
        if case .active = result {
            isAuthenticated = true
        }
    }
}
