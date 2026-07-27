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
        do {
            let result = try await resolveAuthorizedSession.execute(authPrincipal: principal)
            switch result {
            case .authorized(let member):
                await applyAuthorizedSession(
                    principal: principal,
                    member: member
                )
            case .unauthorized(let reason):
                if reason == .emailVerificationRequired {
                    let resent = await authSessionProvider.sendCurrentUserEmailVerification()
                    let signedOut = authSessionProvider.signOut()
                    feedbackCenter.show(
                        resent
                            ? AccessL10nKey.authInfoVerificationResent
                            : AccessL10nKey.authInfoVerificationPending
                    )
                    if signedOut {
                        environmentRouter.resetToBaseEnvironment()
                        mode = .signedOut
                    } else {
                        applyUnauthorizedSession(
                            principalEmail: principal.email,
                            reason: .emailVerificationRequired
                        )
                    }
                } else {
                    applyUnauthorizedSession(principalEmail: principal.email, reason: reason)
                }
            }
        } catch FirebaseFunctionClientError.unauthorized {
            await handleExpiredSession()
        } catch {
            feedbackCenter.show(AccessL10nKey.authErrorNetwork)
            applyUnauthorizedSession(
                principalEmail: principal.email,
                reason: .userAccessRestricted
            )
        }
    }

    func handleExpiredSession() async {
        applyLocalSessionTermination(
            firebaseSignOutSucceeded: authSessionProvider.signOut(),
            showsExpiredDialog: true
        )
    }

    func applyLocalSessionTermination(
        firebaseSignOutSucceeded: Bool,
        showsExpiredDialog: Bool
    ) {
        let principalEmail = currentPrincipalEmail
        clearSessionRefreshTracking()
        environmentRouter.resetToBaseEnvironment()
        Task {
            await KeyManager.shared.remove(.authorizedMemberId)
        }
        resetAccessCredentialsAndErrors()
        isAuthenticating = false
        isRegistering = false
        isRecoveringPassword = false
        feedbackCenter.clear()
        if firebaseSignOutSucceeded {
            mode = .signedOut
        } else {
            mode = .unauthorized(
                email: principalEmail,
                reason: .userAccessRestricted
            )
            feedbackCenter.show(AccessL10nKey.authErrorUnknown)
        }
        showSessionExpiredDialog = showsExpiredDialog
        showUnauthorizedDialog = !firebaseSignOutSucceeded && !showsExpiredDialog
    }

    private var currentPrincipalEmail: String {
        switch mode {
        case .authorized(let session):
            return session.principal.email
        case .unauthorized(let email, _):
            return email
        case .signedOut:
            return normalizeAccessEmail(emailInput)
        }
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
        let members: [Member]
        do {
            members = try await repository.members(visibleTo: member)
        } catch {
            feedbackCenter.show(AccessL10nKey.authErrorNetwork)
            applyUnauthorizedSession(
                principalEmail: principal.email,
                reason: .userAccessRestricted
            )
            return
        }
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
        await registerAuthorizedDeviceBestEffort(member)
    }

    private func registerAuthorizedDeviceBestEffort(_ member: Member) async {
        switch await authorizedDeviceRegistrar.register(member: member) {
        case .registered, .skipped:
            break
        case .failed:
            // Push registration is non-critical. The live registrar records the failure for diagnosis.
            break
        }
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
