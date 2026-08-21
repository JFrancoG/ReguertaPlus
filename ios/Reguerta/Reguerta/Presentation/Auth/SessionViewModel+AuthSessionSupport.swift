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
        let requestedEnvironment = environmentRouter.baseEnvironment
        do {
            let result = try await resolveAuthorizedSession.execute(
                authPrincipal: principal,
                requestedEnvironment: requestedEnvironment
            )
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
                    prepareForResolvedAuthorizationRevocation(principalEmail: principal.email)
                    applyUnauthorizedSession(principalEmail: principal.email, reason: reason)
                }
            case .sessionExpired:
                await handleExpiredSession()
            }
        } catch is CancellationError {
            return
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
        invalidatePasswordRecoveryOperation()
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

    /// Publishes an authorized session while preserving ownership across a benign refresh.
    ///
    /// The same principal UID, active authenticated-member identity, and environment reuse both authorization leases.
    /// If their device registration is still running, that task and its revision remain the sole owner for the shared
    /// lease; a changed authorization replaces the owner. This prevents overlapping registrations from treating the
    /// same persisted context as two independent operations while cleanup targets the exact live leases.
    private func applyAuthorizedSession(
        principal: AuthPrincipal,
        member: Member,
        environment: SessionEnvironment,
        generation: UInt64
    ) async {
        let members: [Member]
        do {
            members = try await repository.members(
                visibleTo: member,
                environment: environment
            )
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
        let reusesLeases = canReuseAuthorizationLeases(for: principal, member: member, environment: environment)
        let environmentLease = reusesLeases ? authorizedEnvironmentLease ?? .init() : .init()
        let deviceSessionLease = reusesLeases ? authorizedDeviceSessionLease ?? .init() : .init()
        authorizedEnvironmentLease = environmentLease
        environmentRouter.applyResolvedEnvironment(environment, lease: environmentLease)
        guard isCurrentSessionOperation(generation), authorizedEnvironmentLease == environmentLease else {
            environmentRouter.resetToBaseEnvironment(ifOwnedBy: environmentLease)
            if authorizedEnvironmentLease == environmentLease {
                authorizedEnvironmentLease = nil
            }
            return
        }
        mode = .authorized(
            AuthorizedSession(
                principal: principal,
                authenticatedMember: member,
                member: member,
                members: members,
                environment: environment
            )
        )
        authorizedDeviceSessionLease = deviceSessionLease
        showSessionExpiredDialog = false
        showUnauthorizedDialog = false
        guard isCurrentSessionOperation(generation) else { return }
        guard !reusesLeases || authorizedDeviceRegistrationTask == nil else { return }
        scheduleAuthorizedDeviceRegistration(
            principal: principal,
            member: member,
            environment: environment,
            lease: deviceSessionLease
        )
    }

    private func canReuseAuthorizationLeases(
        for principal: AuthPrincipal,
        member: Member,
        environment: SessionEnvironment
    ) -> Bool {
        guard authorizedEnvironmentLease != nil,
              authorizedDeviceSessionLease != nil,
              case .authorized(let session) = mode,
              session.representsActiveAuthorization else { return false }
        return session.principal.uid == principal.uid &&
            session.authenticatedMember.id == member.id &&
            member.authUid == principal.uid &&
            member.isActive &&
            session.environment == environment
    }

    private func scheduleAuthorizedDeviceRegistration(
        principal: AuthPrincipal,
        member: Member,
        environment: SessionEnvironment,
        lease: AuthorizedDeviceSessionLease
    ) {
        startAuthorizedDeviceRegistration(
            AuthorizedDeviceRegistrationCommand(
                memberId: member.id,
                authUid: principal.uid,
                environment: environment,
                lease: lease
            )
        )
    }

    private func startAuthorizedDeviceRegistration(_ command: AuthorizedDeviceRegistrationCommand) {
        authorizedDeviceRegistrationRevision &+= 1
        let registrationRevision = authorizedDeviceRegistrationRevision
        authorizedDeviceRegistrationTask?.cancel()
        authorizedDeviceRegistrationTask = nil
        let registrar = authorizedDeviceRegistrar

        authorizedDeviceRegistrationTask = Task { @MainActor [weak self, registrar] in
            defer {
                self?.finishAuthorizedDeviceRegistration(
                    revision: registrationRevision,
                    command: command
                )
            }
            guard self?.isCurrentAuthorizedDeviceRegistration(
                revision: registrationRevision,
                command: command
            ) == true else { return }
            do {
                _ = try await registrar.register(
                    command: command,
                    isSessionCurrent: { [weak self] in
                        self?.isCurrentAuthorizedDeviceRegistration(
                            revision: registrationRevision,
                            command: command
                        ) == true
                    }
                )
            } catch is CancellationError {
                return
            } catch {
                // Push registration is non-critical. The live coordinator records private diagnostics.
            }
        }
    }

    private func finishAuthorizedDeviceRegistration(revision: UInt64, command: AuthorizedDeviceRegistrationCommand) {
        guard revision == authorizedDeviceRegistrationRevision,
              authorizedDeviceSessionLease == command.lease else { return }
        authorizedDeviceRegistrationTask = nil
    }

    private func isCurrentAuthorizedDeviceRegistration(
        revision: UInt64,
        command: AuthorizedDeviceRegistrationCommand
    ) -> Bool {
        guard revision == authorizedDeviceRegistrationRevision,
              authorizedDeviceSessionLease == command.lease,
              case .authorized(let session) = mode,
              session.representsActiveAuthorization else { return false }
        return AuthorizedDeviceRegistrationCommand(
            memberId: session.authenticatedMember.id,
            authUid: session.principal.uid,
            environment: session.environment,
            lease: command.lease
        ) == command
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
