import Foundation
import Testing

@testable import Reguerta

@MainActor
final class ControlledPasswordRecoveryAuthProvider: AuthSessionProvider {
    private struct RequestWaiter {
        let expectedCount: Int
        let continuation: CheckedContinuation<Void, any Error>
    }

    private var passwordResetContinuations: [CheckedContinuation<AuthPasswordResetResult, Never>?] = []
    private var passwordResetRequestWaiters: [UUID: RequestWaiter] = [:]
    private(set) var requestedPasswordResetEmails: [String] = []
    private(set) var completedPasswordResetCount = 0

    func signIn(email _: String, password _: String) async -> AuthSignInResult {
        .failure(.unknown)
    }

    func signUp(email _: String, password _: String) async -> AuthSignUpResult {
        .failure(.unknown)
    }

    func sendPasswordReset(email: String) async -> AuthPasswordResetResult {
        requestedPasswordResetEmails.append(email)
        resumeSatisfiedPasswordResetRequestWaiters()
        let result = await withCheckedContinuation { continuation in
            passwordResetContinuations.append(continuation)
        }
        completedPasswordResetCount += 1
        return result
    }

    func sendCurrentUserEmailVerification() async -> Bool {
        false
    }

    func validIDToken(forcingRefresh _: Bool) async throws -> String {
        "test-token"
    }

    func refreshCurrentSession() async -> AuthSessionRefreshResult {
        .noSession
    }

    @discardableResult func signOut() -> Bool {
        true
    }

    func waitForPasswordResetRequestCount(_ expectedCount: Int) async throws {
        guard requestedPasswordResetEmails.count < expectedCount else { return }
        let waiterID = UUID()
        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, any Error>) in
                guard !Task.isCancelled else {
                    continuation.resume(throwing: CancellationError())
                    return
                }
                guard requestedPasswordResetEmails.count < expectedCount else {
                    continuation.resume()
                    return
                }
                passwordResetRequestWaiters[waiterID] = RequestWaiter(
                    expectedCount: expectedCount,
                    continuation: continuation
                )
            }
        } onCancel: {
            Task { @MainActor [weak self] in
                self?.cancelPasswordResetRequestWaiter(waiterID)
            }
        }
    }

    func completePasswordReset(at index: Int, with result: AuthPasswordResetResult) {
        guard passwordResetContinuations.indices.contains(index),
              let continuation = passwordResetContinuations[index] else {
            Issue.record("No existe la peticion de recuperacion \(index)")
            return
        }
        passwordResetContinuations[index] = nil
        continuation.resume(returning: result)
    }

    func cancelAll() {
        let requestWaiters = passwordResetRequestWaiters.values.map(\.continuation)
        passwordResetRequestWaiters.removeAll()
        requestWaiters.forEach { $0.resume(throwing: CancellationError()) }

        let resetContinuations = passwordResetContinuations.compactMap { $0 }
        passwordResetContinuations = passwordResetContinuations.map { _ in nil }
        resetContinuations.forEach { $0.resume(returning: .failure(.unknown)) }
    }

    private func resumeSatisfiedPasswordResetRequestWaiters() {
        let satisfiedWaiterIDs = passwordResetRequestWaiters.compactMap { waiterID, waiter in
            requestedPasswordResetEmails.count >= waiter.expectedCount ? waiterID : nil
        }
        let continuations = satisfiedWaiterIDs.compactMap { passwordResetRequestWaiters.removeValue(forKey: $0) }
        continuations.forEach { $0.continuation.resume() }
    }

    private func cancelPasswordResetRequestWaiter(_ waiterID: UUID) {
        passwordResetRequestWaiters.removeValue(forKey: waiterID)?.continuation.resume(
            throwing: CancellationError()
        )
    }
}

@MainActor
func makePasswordRecoveryAccessRootViewModel(sessionViewModel: SessionViewModel) -> AccessRootViewModel {
    AccessRootViewModel(
        sessionViewModel: sessionViewModel,
        productsFeatureDependencies: .preview(),
        ordersFeatureDependencies: .preview(),
        shiftsFeatureDependencies: .preview(),
        newsNotificationsFeatureDependencies: .preview(),
        sharedProfileFeatureDependencies: .preview(),
        usersFeatureDependencies: .preview(),
        myOrderFreshnessFeatureDependencies: .preview(),
        bylawsFeatureDependencies: .preview(),
        developmentTimeMachine: DevelopmentTimeMachine(),
        startupVersionGateUseCase: ResolveStartupVersionGateUseCase(
            repository: FixedStartupVersionPolicyRepository(policy: nil),
            environment: .develop
        ),
        shouldSkipSplashProvider: { true }
    )
}
