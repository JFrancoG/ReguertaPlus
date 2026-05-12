import Foundation

extension SessionViewModel {
    func validateSignInInputs(email: String, password: String) -> Bool {
        var isValid = true

        if email.isEmpty {
            emailErrorKey = AccessL10nKey.feedbackEmailRequired
            isValid = false
        } else if !isValidEmail(email) {
            emailErrorKey = AccessL10nKey.feedbackEmailInvalid
            isValid = false
        }

        if password.isEmpty {
            passwordErrorKey = AccessL10nKey.feedbackPasswordRequired
            isValid = false
        } else if !isValidPassword(password) {
            passwordErrorKey = AccessL10nKey.authErrorWeakPassword
            isValid = false
        }

        return isValid
    }

    func validateSignUpInputs(email: String, password: String, repeatedPassword: String) -> Bool {
        var isValid = true

        if email.isEmpty {
            registerEmailErrorKey = AccessL10nKey.feedbackEmailRequired
            isValid = false
        } else if !isValidEmail(email) {
            registerEmailErrorKey = AccessL10nKey.feedbackEmailInvalid
            isValid = false
        }

        if password.isEmpty {
            registerPasswordErrorKey = AccessL10nKey.feedbackPasswordRequired
            isValid = false
        } else if !isValidPassword(password) {
            registerPasswordErrorKey = AccessL10nKey.authErrorWeakPassword
            isValid = false
        }

        if repeatedPassword.isEmpty {
            registerRepeatPasswordErrorKey = AccessL10nKey.feedbackPasswordRepeatRequired
            isValid = false
        } else if !isValidPassword(repeatedPassword) {
            registerRepeatPasswordErrorKey = AccessL10nKey.authErrorWeakPassword
            isValid = false
        } else if repeatedPassword != password {
            registerRepeatPasswordErrorKey = AccessL10nKey.feedbackPasswordMismatch
            isValid = false
        }

        return isValid
    }

    func applySignInFailure(_ reason: AuthSignInFailureReason) {
        let mapped = mapAuthFailure(reason, flow: .signIn)
        emailErrorKey = mapped.emailErrorKey
        passwordErrorKey = mapped.passwordErrorKey
        feedbackMessageKey = mapped.globalMessageKey
    }

    func applySignUpFailure(_ reason: AuthSignInFailureReason) {
        let mapped = mapAuthFailure(reason, flow: .signUp)
        registerEmailErrorKey = mapped.emailErrorKey
        registerPasswordErrorKey = mapped.passwordErrorKey
        feedbackMessageKey = mapped.globalMessageKey
    }

    func applyPasswordResetFailure(_ reason: AuthSignInFailureReason) {
        let mapped = mapAuthFailure(reason, flow: .passwordReset)
        recoverEmailErrorKey = mapped.emailErrorKey
        feedbackMessageKey = mapped.globalMessageKey
    }

    func applyAuthorizedSession(
        principal: AuthPrincipal,
        shouldRefreshCriticalData: Bool = true
    ) async {
        await reviewerEnvironmentRouter.applyRouting(for: principal)
        let result = await resolveAuthorizedSession.execute(authPrincipal: principal)
        switch result {
        case .authorized(let member):
            await applyAuthorizedSession(
                principal: principal,
                member: member,
                shouldRefreshCriticalData: shouldRefreshCriticalData
            )
        case .unauthorized(let reason):
            applyUnauthorizedSession(principalEmail: principal.email, reason: reason)
        }
    }

    func shouldRefreshCriticalData(for principal: AuthPrincipal) -> Bool {
        switch mode {
        case .signedOut:
            return true
        case .unauthorized(let email, _):
            return email != principal.email
        case .authorized(let session):
            return session.principal.uid != principal.uid
        }
    }

    func handleExpiredSession() async {
        clearSessionRefreshTracking()
        reviewerEnvironmentRouter.resetToBaseEnvironment()
        resetAccessCredentialsAndErrors()
        isAuthenticating = false
        isRegistering = false
        isRecoveringPassword = false
        feedbackMessageKey = nil
        mode = .signedOut
        memberDraft = MemberDraft()
        myOrderFreshnessState = .idle
        showSessionExpiredDialog = true
        showUnauthorizedDialog = false
        await criticalDataFreshnessLocalRepository.clear()
    }

    func resetAccessCredentialsAndErrors() {
        emailInput = ""
        passwordInput = ""
        registerEmailInput = ""
        registerPasswordInput = ""
        registerRepeatPasswordInput = ""
        recoverEmailInput = ""
        emailErrorKey = nil
        passwordErrorKey = nil
        registerEmailErrorKey = nil
        registerPasswordErrorKey = nil
        registerRepeatPasswordErrorKey = nil
        recoverEmailErrorKey = nil
    }

    func clearSessionRefreshTracking() {
        lastSessionRefreshAtMillis = nil
        isSessionRefreshInFlight = false
    }

    private func applyAuthorizedSession(
        principal: AuthPrincipal,
        member: Member,
        shouldRefreshCriticalData: Bool
    ) async {
        let members = await repository.allMembers()
        mode = .authorized(
            AuthorizedSession(
                principal: principal,
                authenticatedMember: member,
                member: member,
                members: members
            )
        )
        showSessionExpiredDialog = false
        showUnauthorizedDialog = false
        if shouldRefreshCriticalData {
            myOrderFreshnessState = .checking
            refreshMyOrderFreshness()
        }
        await authorizedDeviceRegistrar.register(member: member)
    }

    private func applyUnauthorizedSession(principalEmail: String, reason: UnauthorizedReason) {
        let shouldShowDialog = shouldShowUnauthorizedDialog(
            for: principalEmail,
            reason: reason
        )
        mode = .unauthorized(email: principalEmail, reason: reason)
        showSessionExpiredDialog = false
        showUnauthorizedDialog = shouldShowDialog
        myOrderFreshnessState = .idle
    }

    func applyUpdatedAuthorizedMember(_ updatedMember: Member, members: [Member]) {
        guard case .authorized(let session) = mode else { return }

        mode = .authorized(
            AuthorizedSession(
                principal: session.principal,
                authenticatedMember: session.authenticatedMember.id == updatedMember.id
                    ? updatedMember
                    : session.authenticatedMember,
                member: session.member.id == updatedMember.id ? updatedMember : session.member,
                members: members
            )
        )
    }

    private func shouldShowUnauthorizedDialog(for email: String, reason: UnauthorizedReason) -> Bool {
        guard reason == .userNotFoundInAuthorizedUsers else { return false }
        if case .unauthorized(let currentEmail, _) = mode {
            return currentEmail != email
        }
        return true
    }
}
