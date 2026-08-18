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
        await applyAuthorizedSession(
            principal: principal,
            generation: sessionOperationGeneration
        )
    }

    func applyAuthorizedSession(principal: AuthPrincipal, generation: UInt64) async {
        do {
            let result = try await resolveAuthorizedSession.execute(authPrincipal: principal)
            guard isCurrentSessionOperation(generation) else { return }
            switch result {
            case .authorized(let member, let environment):
                await applyAuthorizedSession(
                    principal: principal,
                    member: member,
                    environment: environment,
                    generation: generation
                )
            case .unauthorized(let reason):
                if reason == .emailVerificationRequired {
                    let resent = await authSessionProvider.sendCurrentUserEmailVerification()
                    guard isCurrentSessionOperation(generation) else { return }
                    let signedOut = authSessionProvider.signOut()
                    applyEmailVerificationRequiredSession(
                        email: principal.email,
                        firebaseSignOutSucceeded: signedOut,
                        feedbackMessageKey: resent
                            ? AccessL10nKey.authInfoVerificationResent
                            : AccessL10nKey.authInfoVerificationPending
                    )
                } else {
                    applyUnauthorizedSession(principalEmail: principal.email, reason: reason)
                }
            }
        } catch FirebaseFunctionClientError.unauthorized {
            guard isCurrentSessionOperation(generation) else { return }
            await handleExpiredSession()
        } catch {
            guard isCurrentSessionOperation(generation) else { return }
            applyLocalSessionTermination(
                firebaseSignOutSucceeded: authSessionProvider.signOut(),
                showsExpiredDialog: false
            )
            feedbackCenter.show(AccessL10nKey.authErrorSessionData)
        }
    }

    func handleExpiredSession() async {
        applyLocalSessionTermination(
            firebaseSignOutSucceeded: authSessionProvider.signOut(),
            showsExpiredDialog: true
        )
    }

    var currentPrincipalEmail: String {
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

    func canStartSessionRefresh(trigger: SessionRefreshTrigger) -> Bool {
        guard sessionOperationState == .idle, !isAuthenticating, !isRegistering else { return false }
        return sessionRefreshPolicy.shouldRefresh(
            trigger: trigger,
            lastRefreshAtMillis: lastSessionRefreshAtMillis,
            nowMillis: nowMillisProvider(),
            isRefreshInFlight: isSessionRefreshInFlight
        )
    }

    func applySessionRefreshResult(
        _ result: AuthSessionRefreshResult,
        hadAuthenticatedSession: Bool,
        generation: UInt64
    ) async {
        switch result {
        case .noSession:
            if hadAuthenticatedSession {
                await handleExpiredSession()
            }
        case .active(let principal):
            await applyAuthorizedSession(principal: principal, generation: generation)
        case .emailVerificationRequired(let email):
            applyEmailVerificationRequiredSession(
                email: email,
                firebaseSignOutSucceeded: authSessionProvider.signOut(),
                feedbackMessageKey: AccessL10nKey.authInfoVerificationPending
            )
        case .failure(let reason):
            let mapped = mapAuthFailure(reason, flow: .signIn)
            feedbackCenter.show(mapped.globalMessageKey)
        case .failureAfterAuthenticationMutation(let reason, let signedOut):
            let mapped = mapAuthFailure(reason, flow: .signIn)
            applyLocalSessionTermination(
                firebaseSignOutSucceeded: signedOut,
                showsExpiredDialog: false
            )
            feedbackCenter.show(mapped.globalMessageKey)
        case .expired:
            await handleExpiredSession()
        }
    }

    private func applyAuthorizedSession(
        principal: AuthPrincipal,
        member: Member,
        environment: SessionEnvironment,
        generation: UInt64
    ) async {
        let members: [Member]
        do {
            members = try await repository.members(visibleTo: member)
        } catch {
            guard isCurrentSessionOperation(generation) else { return }
            applyLocalSessionTermination(
                firebaseSignOutSucceeded: authSessionProvider.signOut(),
                showsExpiredDialog: false
            )
            feedbackCenter.show(AccessL10nKey.authErrorSessionData)
            return
        }
        guard isCurrentSessionOperation(generation) else { return }
        mode = .authorized(
            AuthorizedSession(
                principal: principal,
                authenticatedMember: member,
                member: member,
                members: members,
                environment: environment
            )
        )
        let deviceSessionLease = AuthorizedDeviceSessionLease()
        authorizedDeviceSessionLease = deviceSessionLease
        showSessionExpiredDialog = false
        showUnauthorizedDialog = false
        guard isCurrentSessionOperation(generation) else { return }
        await registerAuthorizedDeviceBestEffort(
            principal: principal,
            member: member,
            environment: environment,
            lease: deviceSessionLease,
            generation: generation
        )
    }

    private func registerAuthorizedDeviceBestEffort(
        principal: AuthPrincipal,
        member: Member,
        environment: SessionEnvironment,
        lease: AuthorizedDeviceSessionLease,
        generation: UInt64
    ) async {
        do {
            _ = try await authorizedDeviceRegistrar.register(
                command: AuthorizedDeviceRegistrationCommand(
                    memberId: member.id,
                    authUid: principal.uid,
                    environment: environment,
                    lease: lease
                ),
                isSessionCurrent: { [weak self] in
                    guard let self else { return false }
                    return self.isCurrentSessionOperation(generation) &&
                        self.authorizedDeviceSessionLease == lease
                }
            )
        } catch is CancellationError {
            return
        } catch {
            // Push registration is non-critical. The live coordinator records private diagnostics.
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
                members: members,
                environment: session.environment
            )
        )
    }

    func applyRefreshedAuthorizedMembers(_ members: [Member]) {
        guard case .authorized(let session) = mode else { return }
        let refreshedMembers = members.isEmpty ? session.members : members
        let authenticatedMember = refreshedMembers.first {
            $0.id == session.authenticatedMember.id
        } ?? session.authenticatedMember
        let refreshedSelectedMember = refreshedMembers.first {
            $0.id == session.member.id
        } ?? session.member
        let refreshedSession = AuthorizedSession(
            principal: session.principal,
            authenticatedMember: authenticatedMember,
            member: authenticatedMember.canManageMembers
                ? refreshedSelectedMember
                : authenticatedMember,
            members: refreshedMembers,
            environment: session.environment
        )
        guard refreshedSession != session else { return }
        mode = .authorized(refreshedSession)
    }

    private func shouldShowUnauthorizedDialog(for email: String, reason: UnauthorizedReason) -> Bool {
        guard reason == .userNotFoundInAuthorizedUsers else { return false }
        if case .unauthorized(let currentEmail, _) = mode {
            return currentEmail != email
        }
        return true
    }
}
