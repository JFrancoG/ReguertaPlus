import Foundation

extension SessionViewModel {
    func signIn() {
        let email = normalizeAccessEmail(emailInput)
        let password = passwordInput
        feedbackCenter.clear()
        emailErrorKey = nil
        passwordErrorKey = nil

        guard validateSignInInputs(email: email, password: password) else {
            return
        }

        let operation = beginSessionOperation()
        let provider = authSessionProvider
        isAuthenticating = true
        sessionOperationTask = Task { @MainActor [weak self, provider] in
            await operation.predecessor?.value
            guard self?.isCurrentSessionOperation(operation.generation) == true else { return }

            let authResult = await provider.signIn(email: email, password: password)
            guard let self else {
                _ = provider.signOut()
                return
            }
            defer { self.finishSessionOperation(operation.generation) }
            guard isCurrentSessionOperation(operation.generation) else {
                _ = provider.signOut()
                return
            }

            switch authResult {
            case .success(let principal):
                await applyAuthorizedSession(principal: principal, generation: operation.generation)
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
            }
        }
    }

    func signUp() {
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

        let operation = beginSessionOperation()
        let provider = authSessionProvider
        isRegistering = true
        sessionOperationTask = Task { @MainActor [weak self, provider] in
            await operation.predecessor?.value
            guard self?.isCurrentSessionOperation(operation.generation) == true else { return }

            let authResult = await provider.signUp(email: email, password: password)
            guard let self else {
                _ = provider.signOut()
                return
            }
            defer { self.finishSessionOperation(operation.generation) }
            guard isCurrentSessionOperation(operation.generation) else {
                _ = provider.signOut()
                return
            }

            switch authResult {
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
            }
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

        let operation = beginSessionOperation()
        let provider = authSessionProvider
        isSessionRefreshInFlight = true
        let hadAuthenticatedSession = mode.isAuthenticatedSession
        sessionOperationTask = Task { @MainActor [weak self, provider] in
            await operation.predecessor?.value
            guard self?.isCurrentSessionOperation(operation.generation) == true else { return }

            let result = await provider.refreshCurrentSession()
            guard let self else {
                _ = provider.signOut()
                return
            }
            defer {
                self.finishSessionOperation(operation.generation)
            }
            guard isCurrentSessionOperation(operation.generation) else {
                _ = provider.signOut()
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
