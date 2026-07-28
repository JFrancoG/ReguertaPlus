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
    private let immediateSignUpResult: AuthSignUpResult?
    private let immediateRefreshResult: AuthSessionRefreshResult?
    private var signOutResults: [Bool]
    private var signInContinuations: [CheckedContinuation<AuthSignInResult, Never>?] = []
    private var signUpContinuations: [CheckedContinuation<AuthSignUpResult, Never>?] = []
    private var refreshContinuations: [CheckedContinuation<AuthSessionRefreshResult, Never>?] = []
    private(set) var signInRequestCount = 0
    private(set) var signUpRequestCount = 0
    private(set) var refreshRequestCount = 0
    private(set) var signOutCallCount = 0
    private(set) var isAuthenticated: Bool
    private(set) var events: [Event] = []

    init(
        signInResult: AuthSignInResult? = nil,
        signUpResult: AuthSignUpResult? = nil,
        refreshResult: AuthSessionRefreshResult? = nil,
        isAuthenticated: Bool = false,
        signOutResults: [Bool] = []
    ) {
        immediateSignInResult = signInResult
        immediateSignUpResult = signUpResult
        immediateRefreshResult = refreshResult
        self.isAuthenticated = isAuthenticated
        self.signOutResults = signOutResults
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
        signUpRequestCount += 1
        if let immediateSignUpResult {
            applyAuthenticationState(for: immediateSignUpResult)
            return immediateSignUpResult
        }
        let result = await withCheckedContinuation { continuation in
            signUpContinuations.append(continuation)
        }
        applyAuthenticationState(for: result)
        return result
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
        let succeeded = signOutResults.isEmpty ? true : signOutResults.removeFirst()
        if succeeded {
            isAuthenticated = false
        }
        events.append(.signOut)
        return succeeded
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

    func waitForSignUpRequestCount(_ expectedCount: Int) async -> Bool {
        for _ in 0 ..< 1_000 {
            if signUpRequestCount >= expectedCount {
                return true
            }
            await Task.yield()
        }
        Issue.record("No se iniciaron \(expectedCount) peticiones de alta")
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

    func completeSignUp(at index: Int = 0, with result: AuthSignUpResult) {
        guard signUpContinuations.indices.contains(index),
              let continuation = signUpContinuations[index] else {
            Issue.record("No existe la petición de alta \(index)")
            return
        }
        signUpContinuations[index] = nil
        continuation.resume(returning: result)
    }

    private func applyAuthenticationState(for result: AuthSignInResult) {
        switch result {
        case .success:
            isAuthenticated = true
        case .emailVerificationRequired(_, _, let signedOut):
            isAuthenticated = !signedOut
        case .failureAfterAuthenticationMutation(_, let signedOut):
            isAuthenticated = !signedOut
        case .failure:
            break
        }
    }

    private func applyAuthenticationState(for result: AuthSessionRefreshResult) {
        switch result {
        case .active:
            isAuthenticated = true
        case .failureAfterAuthenticationMutation(_, let signedOut):
            isAuthenticated = !signedOut
        case .noSession, .emailVerificationRequired, .failure, .expired:
            break
        }
    }

    private func applyAuthenticationState(for result: AuthSignUpResult) {
        switch result {
        case .verificationRequired(_, _, let signedOut),
             .failureAfterAuthenticationMutation(_, let signedOut):
            isAuthenticated = !signedOut
        case .failure:
            break
        }
    }
}
