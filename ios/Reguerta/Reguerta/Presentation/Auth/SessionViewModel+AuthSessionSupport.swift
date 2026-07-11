import Foundation

extension SessionViewModel {
    func validateSignInInputs(email: String, password: String) -> Bool {
        var isValid = true

        if email.isEmpty {
            emailErrorKey = AccessL10nKey.feedbackEmailRequired
            isValid = false
        } else if !isValidAccessEmail(email) {
            emailErrorKey = AccessL10nKey.feedbackEmailInvalid
            isValid = false
        }

        if password.isEmpty {
            passwordErrorKey = AccessL10nKey.feedbackPasswordRequired
            isValid = false
        } else if !isValidAccessPassword(password) {
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
        } else if !isValidAccessEmail(email) {
            registerEmailErrorKey = AccessL10nKey.feedbackEmailInvalid
            isValid = false
        }

        if password.isEmpty {
            registerPasswordErrorKey = AccessL10nKey.feedbackPasswordRequired
            isValid = false
        } else if !isValidAccessPassword(password) {
            registerPasswordErrorKey = AccessL10nKey.authErrorWeakPassword
            isValid = false
        }

        if repeatedPassword.isEmpty {
            registerRepeatPasswordErrorKey = AccessL10nKey.feedbackPasswordRepeatRequired
            isValid = false
        } else if !isValidAccessPassword(repeatedPassword) {
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
        feedbackCenter.show(mapped.globalMessageKey)
    }

    func applySignUpFailure(_ reason: AuthSignInFailureReason) {
        let mapped = mapAuthFailure(reason, flow: .signUp)
        registerEmailErrorKey = mapped.emailErrorKey
        registerPasswordErrorKey = mapped.passwordErrorKey
        feedbackCenter.show(mapped.globalMessageKey)
    }

    func applyPasswordResetFailure(_ reason: AuthSignInFailureReason) {
        let mapped = mapAuthFailure(reason, flow: .passwordReset)
        recoverEmailErrorKey = mapped.emailErrorKey
        feedbackCenter.show(mapped.globalMessageKey)
    }

    func applyAuthorizedSession(principal: AuthPrincipal) async {
        await reviewerEnvironmentRouter.applyRouting(for: principal)
        let result = await resolveAuthorizedSession.execute(authPrincipal: principal)
        switch result {
        case .authorized(let member):
            await applyAuthorizedSession(
                principal: principal,
                member: member
            )
        case .unauthorized(let reason):
            applyUnauthorizedSession(principalEmail: principal.email, reason: reason)
        }
    }

    func handleExpiredSession() async {
        clearSessionRefreshTracking()
        reviewerEnvironmentRouter.resetToBaseEnvironment()
        resetAccessCredentialsAndErrors()
        isAuthenticating = false
        isRegistering = false
        isRecoveringPassword = false
        feedbackCenter.clear()
        mode = .signedOut
        showSessionExpiredDialog = true
        showUnauthorizedDialog = false
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
        member: Member
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

    func applyRefreshedAuthorizedMembers(_ members: [Member]) {
        guard case .authorized(let session) = mode else { return }
        let refreshedMembers = members.isEmpty ? session.members : members
        mode = .authorized(
            AuthorizedSession(
                principal: session.principal,
                authenticatedMember: refreshedMembers.first { $0.id == session.authenticatedMember.id }
                    ?? session.authenticatedMember,
                member: refreshedMembers.first { $0.id == session.member.id } ?? session.member,
                members: refreshedMembers
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
