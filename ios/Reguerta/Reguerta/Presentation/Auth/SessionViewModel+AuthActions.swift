import Foundation

extension SessionViewModel {
    func signIn() {
        guard sessionOperationState == .idle else { return }
        let email = normalizeAccessEmail(emailInput)
        let password = passwordInput
        feedbackCenter.clear()
        emailErrorKey = nil
        passwordErrorKey = nil

        guard validateSignInInputs(email: email, password: password) else {
            return
        }

        guard let operation = beginSessionOperation(principalEmail: email) else { return }
        let provider = authSessionProvider
        isAuthenticating = true
        sessionOperationTask = Task { @MainActor [weak self, provider] in
            defer {
                self?.finishSessionOperationAfterProviderReturn(operation.generation)
            }
            await operation.predecessor?.value
            guard self?.isCurrentSessionOperation(operation.generation) == true else { return }
            self?.startSessionOperationTimeout(operation.generation)

            let authResult = await provider.signIn(email: email, password: password)
            guard let self else {
                _ = provider.signOut()
                return
            }
            guard isCurrentSessionOperation(operation.generation) else {
                if !isDrainingSessionOperation(operation.generation) {
                    _ = provider.signOut()
                }
                return
            }

            await applySignInResult(
                authResult,
                generation: operation.generation
            )
        }
    }

    func signUp() {
        guard sessionOperationState == .idle else { return }
        let email = normalizeAccessEmail(registerEmailInput)
        let password = registerPasswordInput
        let repeatedPassword = registerRepeatPasswordInput
        feedbackCenter.clear()
        registerEmailErrorKey = nil
        registerPasswordErrorKey = nil
        registerRepeatPasswordErrorKey = nil

        guard validateSignUpInputs(email: email, password: password, repeatedPassword: repeatedPassword) else {
            return
        }

        guard let operation = beginSessionOperation(principalEmail: email) else { return }
        let provider = authSessionProvider
        isRegistering = true
        sessionOperationTask = Task { @MainActor [weak self, provider] in
            defer {
                self?.finishSessionOperationAfterProviderReturn(operation.generation)
            }
            await operation.predecessor?.value
            guard self?.isCurrentSessionOperation(operation.generation) == true else { return }
            self?.startSessionOperationTimeout(operation.generation)

            let authResult = await provider.signUp(email: email, password: password)
            guard let self else {
                _ = provider.signOut()
                return
            }
            guard isCurrentSessionOperation(operation.generation) else {
                if !isDrainingSessionOperation(operation.generation) {
                    _ = provider.signOut()
                }
                return
            }

            applySignUpResult(authResult)
        }
    }

    private func applySignInResult(
        _ result: AuthSignInResult,
        generation: UInt64
    ) async {
        switch result {
        case .success(let principal):
            await applyAuthorizedSession(principal: principal, generation: generation)
        case .emailVerificationRequired(let email, let verificationResent, let signedOut):
            applyEmailVerificationRequiredSession(
                email: email,
                firebaseSignOutSucceeded: signedOut,
                feedbackMessageKey: verificationResent
                    ? AccessL10nKey.authInfoVerificationResent
                    : AccessL10nKey.authInfoVerificationPending
            )
        case .failure(let reason):
            applySignInFailure(reason)
        case .failureAfterAuthenticationMutation(let reason, let signedOut):
            applyLocalSessionTermination(
                firebaseSignOutSucceeded: signedOut,
                showsExpiredDialog: false
            )
            applySignInFailure(reason)
        }
    }

    private func applySignUpResult(_ result: AuthSignUpResult) {
        switch result {
        case .verificationRequired(let email, let verificationSent, let signedOut):
            applyEmailVerificationRequiredSession(
                email: email,
                firebaseSignOutSucceeded: signedOut,
                feedbackMessageKey: verificationSent
                    ? AccessL10nKey.authInfoVerificationSent
                    : AccessL10nKey.authInfoVerificationPending
            )
        case .failure(let reason):
            applySignUpFailure(reason)
        case .failureAfterAuthenticationMutation(let reason, let signedOut):
            applyLocalSessionTermination(
                firebaseSignOutSucceeded: signedOut,
                showsExpiredDialog: false
            )
            applySignUpFailure(reason)
        }
    }

    func signOut() {
        applyLocalSessionTermination(
            firebaseSignOutSucceeded: authSessionProvider.signOut(),
            showsExpiredDialog: false
        )
    }

    func dismissSessionExpiredDialog() {
        showSessionExpiredDialog = false
    }

    func dismissUnauthorizedDialog() {
        showUnauthorizedDialog = false
    }

    func impersonate(memberId: String) {
        guard developImpersonationEnabled else { return }
        guard case .authorized(let session) = mode else { return }
        guard let target = session.members.first(where: { $0.id == memberId && $0.isActive }) else { return }

        mode = .authorized(
            AuthorizedSession(
                principal: session.principal,
                authenticatedMember: session.authenticatedMember,
                member: target,
                members: session.members,
                environment: session.environment
            )
        )
    }

    func clearImpersonation() {
        guard developImpersonationEnabled else { return }
        guard case .authorized(let session) = mode else { return }
        guard session.member.id != session.authenticatedMember.id else { return }

        mode = .authorized(
            AuthorizedSession(
                principal: session.principal,
                authenticatedMember: session.authenticatedMember,
                member: session.authenticatedMember,
                members: session.members,
                environment: session.environment
            )
        )
    }

    func refreshSession(trigger: SessionRefreshTrigger) {
        guard canStartSessionRefresh(trigger: trigger) else { return }

        guard let operation = beginSessionOperation(
            principalEmail: currentPrincipalEmail
        ) else { return }
        let provider = authSessionProvider
        isSessionRefreshInFlight = true
        let hadAuthenticatedSession = mode.isAuthenticatedSession
        sessionOperationTask = Task { @MainActor [weak self, provider] in
            defer {
                self?.finishSessionOperationAfterProviderReturn(operation.generation)
            }
            await operation.predecessor?.value
            guard self?.isCurrentSessionOperation(operation.generation) == true else { return }
            self?.startSessionOperationTimeout(operation.generation)

            let result = await provider.refreshCurrentSession()
            guard let self else {
                _ = provider.signOut()
                return
            }
            guard isCurrentSessionOperation(operation.generation) else {
                if !isDrainingSessionOperation(operation.generation) {
                    _ = provider.signOut()
                }
                return
            }
            await applySessionRefreshResult(
                result,
                hadAuthenticatedSession: hadAuthenticatedSession,
                generation: operation.generation
            )

            guard isCurrentSessionOperation(operation.generation) else { return }
            lastSessionRefreshAtMillis = nowMillisProvider()
        }
    }

    func sendPasswordReset() {
        let email = normalizeAccessEmail(recoverEmailInput)
        feedbackCenter.clear()
        recoverEmailErrorKey = nil

        if email.isEmpty {
            recoverEmailErrorKey = AccessL10nKey.feedbackEmailRequired
            return
        }
        if !isValidAccessEmail(email) {
            recoverEmailErrorKey = AccessL10nKey.feedbackEmailInvalid
            return
        }

        isRecoveringPassword = true
        Task { @MainActor in
            let result = await authSessionProvider.sendPasswordReset(email: email)
            switch result {
            case .success:
                feedbackCenter.show(AccessL10nKey.authInfoPasswordResetSent)
            case .failure(let reason):
                applyPasswordResetFailure(reason)
            }
            isRecoveringPassword = false
        }
    }

    func resetSignInDraft() {
        emailInput = ""
        passwordInput = ""
        emailErrorKey = nil
        passwordErrorKey = nil
        isAuthenticating = false
    }

    func resetSignUpDraft() {
        registerEmailInput = ""
        registerPasswordInput = ""
        registerRepeatPasswordInput = ""
        registerEmailErrorKey = nil
        registerPasswordErrorKey = nil
        registerRepeatPasswordErrorKey = nil
        isRegistering = false
    }

    func resetRecoverDraft() {
        recoverEmailInput = ""
        recoverEmailErrorKey = nil
        isRecoveringPassword = false
    }

}
