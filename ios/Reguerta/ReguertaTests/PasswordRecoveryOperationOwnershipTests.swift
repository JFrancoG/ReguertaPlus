import Testing

@testable import Reguerta

@Suite(.timeLimit(.minutes(1)))
@MainActor
struct PasswordRecoveryOperationOwnershipTests {
    @Test("Salir de recuperacion descarta un exito tardio")
    func routeExitDiscardsLateSuccess() async throws {
        let provider = ControlledPasswordRecoveryAuthProvider()
        defer { provider.cancelAll() }
        let feedbackCenter = GlobalFeedbackCenter()
        let viewModel = SessionViewModel(
            feedbackCenter: feedbackCenter,
            authSessionProvider: provider
        )
        viewModel.recoverEmailInput = "member@example.com"

        viewModel.sendPasswordReset()
        try await provider.waitForPasswordResetRequestCount(1)
        let staleOperation = try #require(viewModel.passwordRecoveryOperationTask)
        #expect(viewModel.isRecoveringPassword)

        viewModel.resetRecoverDraft()
        provider.completePasswordReset(at: 0, with: .success)
        await staleOperation.value

        #expect(viewModel.recoverEmailInput.isEmpty)
        #expect(viewModel.isRecoveringPassword == false)
        #expect(feedbackCenter.messageKey == nil)
    }

    @Test("La terminacion local descarta un exito tardio de recuperacion")
    func localSessionTerminationDiscardsLateSuccess() async throws {
        let provider = ControlledPasswordRecoveryAuthProvider()
        defer { provider.cancelAll() }
        let feedbackCenter = GlobalFeedbackCenter()
        let viewModel = SessionViewModel(
            feedbackCenter: feedbackCenter,
            authSessionProvider: provider
        )
        viewModel.recoverEmailInput = "member@example.com"
        viewModel.sendPasswordReset()
        try await provider.waitForPasswordResetRequestCount(1)
        let staleOperation = try #require(viewModel.passwordRecoveryOperationTask)

        viewModel.signOut()
        provider.completePasswordReset(at: 0, with: .success)
        await staleOperation.value

        #expect(viewModel.mode == .signedOut)
        #expect(viewModel.isRecoveringPassword == false)
        #expect(feedbackCenter.messageKey == nil)
    }

    @Test("Un fallo anterior no pisa una reentrada en recuperacion")
    func staleFailureDoesNotOverwriteReentry() async throws {
        let provider = ControlledPasswordRecoveryAuthProvider()
        defer { provider.cancelAll() }
        let feedbackCenter = GlobalFeedbackCenter()
        let viewModel = SessionViewModel(
            feedbackCenter: feedbackCenter,
            authSessionProvider: provider
        )
        viewModel.recoverEmailInput = "first@example.com"
        viewModel.sendPasswordReset()
        try await provider.waitForPasswordResetRequestCount(1)
        let staleOperation = try #require(viewModel.passwordRecoveryOperationTask)

        viewModel.resetRecoverDraft()
        viewModel.recoverEmailInput = "second@example.com"
        viewModel.sendPasswordReset()
        try await provider.waitForPasswordResetRequestCount(2)
        let successorOperation = try #require(viewModel.passwordRecoveryOperationTask)

        provider.completePasswordReset(at: 0, with: .failure(.invalidEmail))
        await staleOperation.value

        #expect(viewModel.recoverEmailInput == "second@example.com")
        #expect(viewModel.recoverEmailErrorKey == nil)
        #expect(viewModel.isRecoveringPassword)
        #expect(feedbackCenter.messageKey == nil)

        provider.completePasswordReset(at: 1, with: .success)
        await successorOperation.value
    }

    @Test("El exito actual se publica una sola vez")
    func currentSuccessPublishesOnce() async throws {
        let provider = ControlledPasswordRecoveryAuthProvider()
        defer { provider.cancelAll() }
        let feedbackCenter = GlobalFeedbackCenter()
        let viewModel = SessionViewModel(
            feedbackCenter: feedbackCenter,
            authSessionProvider: provider
        )
        viewModel.recoverEmailInput = "member@example.com"

        viewModel.sendPasswordReset()
        try await provider.waitForPasswordResetRequestCount(1)
        let operation = try #require(viewModel.passwordRecoveryOperationTask)
        provider.completePasswordReset(at: 0, with: .success)
        await operation.value

        #expect(provider.requestedPasswordResetEmails == ["member@example.com"])
        #expect(provider.completedPasswordResetCount == 1)
        #expect(feedbackCenter.messageKey == AccessL10nKey.authInfoPasswordResetSent)
        #expect(viewModel.isRecoveringPassword == false)
    }

    @Test("Back del shell invalida la recuperacion antes de un exito tardio")
    func shellBackInvalidatesSuspendedRecoveryBeforeLateSuccess() async throws {
        let provider = ControlledPasswordRecoveryAuthProvider()
        defer { provider.cancelAll() }
        let feedbackCenter = GlobalFeedbackCenter()
        let sessionViewModel = SessionViewModel(
            feedbackCenter: feedbackCenter,
            authSessionProvider: provider
        )
        let rootViewModel = makePasswordRecoveryAccessRootViewModel(sessionViewModel: sessionViewModel)
        rootViewModel.shellState = AuthShellState(backStack: [.welcome, .login, .recoverPassword])
        sessionViewModel.recoverEmailInput = "member@example.com"

        sessionViewModel.sendPasswordReset()
        try await provider.waitForPasswordResetRequestCount(1)
        let staleOperation = try #require(sessionViewModel.passwordRecoveryOperationTask)
        rootViewModel.dispatchShell(.back)

        provider.completePasswordReset(at: 0, with: .success)
        await staleOperation.value

        #expect(rootViewModel.shellState.currentRoute == .login)
        #expect(sessionViewModel.recoverEmailInput.isEmpty)
        #expect(sessionViewModel.isRecoveringPassword == false)
        #expect(feedbackCenter.messageKey == nil)
        #expect(rootViewModel.showsRecoverSuccessDialog == false)
    }
}
