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

        isAuthenticating = true
        Task { @MainActor in
            let authResult = await authSessionProvider.signIn(email: email, password: password)

            switch authResult {
            case .success(let principal):
                await applyAuthorizedSession(principal: principal)
            case .failure(let reason):
                applySignInFailure(reason)
            }

            isAuthenticating = false
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

        isRegistering = true
        Task { @MainActor in
            let authResult = await authSessionProvider.signUp(email: email, password: password)

            switch authResult {
            case .success(let principal):
                await applyAuthorizedSession(principal: principal)
                registerEmailInput = ""
                registerPasswordInput = ""
                registerRepeatPasswordInput = ""
            case .failure(let reason):
                applySignUpFailure(reason)
            }

            isRegistering = false
        }
    }

    func signOut() {
        authSessionProvider.signOut()
        clearSessionRefreshTracking()
        reviewerEnvironmentRouter.resetToBaseEnvironment()
        Task {
            await KeyManager.shared.remove(.authorizedMemberId)
        }
        resetAccessCredentialsAndErrors()
        isAuthenticating = false
        isRegistering = false
        isRecoveringPassword = false
        feedbackCenter.clear()
        mode = .signedOut
        showSessionExpiredDialog = false
        showUnauthorizedDialog = false
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
                members: session.members
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
                members: session.members
            )
        )
    }

    func refreshSession(trigger: SessionRefreshTrigger) {
        let nowMillis = nowMillisProvider()
        guard sessionRefreshPolicy.shouldRefresh(
            trigger: trigger,
            lastRefreshAtMillis: lastSessionRefreshAtMillis,
            nowMillis: nowMillis,
            isRefreshInFlight: isSessionRefreshInFlight
        ) else {
            return
        }

        isSessionRefreshInFlight = true
        let hadAuthenticatedSession = mode.isAuthenticatedSession
        Task { @MainActor in
            defer {
                lastSessionRefreshAtMillis = nowMillisProvider()
                isSessionRefreshInFlight = false
            }

            let result = await authSessionProvider.refreshCurrentSession()
            switch result {
            case .noSession:
                if hadAuthenticatedSession {
                    await handleExpiredSession()
                }
            case .active(let principal):
                await applyAuthorizedSession(principal: principal)
            case .expired:
                await handleExpiredSession()
            }
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
