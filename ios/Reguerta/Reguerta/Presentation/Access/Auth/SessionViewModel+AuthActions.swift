import Foundation

extension SessionViewModel {
    func signIn() {
        let email = normalizeEmail(emailInput)
        let password = passwordInput
        feedbackMessageKey = nil
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
        let email = normalizeEmail(registerEmailInput)
        let password = registerPasswordInput
        let repeatedPassword = registerRepeatPasswordInput
        feedbackMessageKey = nil
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
        feedbackMessageKey = nil
        mode = .signedOut
        memberDraft = MemberDraft()
        myOrderFreshnessState = .idle
        showSessionExpiredDialog = false
        showUnauthorizedDialog = false
        resetSessionContentState()
        Task {
            await criticalDataFreshnessLocalRepository.clear()
        }
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
        refreshNews()
        refreshNotifications()
        refreshSharedProfiles()
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
        refreshNews()
        refreshNotifications()
        refreshSharedProfiles()
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
                let shouldRefreshCriticalData = !hadAuthenticatedSession || shouldRefreshCriticalData(for: principal)
                await applyAuthorizedSession(
                    principal: principal,
                    shouldRefreshCriticalData: shouldRefreshCriticalData
                )
            case .expired:
                await handleExpiredSession()
            }
        }
    }

    func refreshMyOrderFreshness() {
        guard case .authorized(let session) = mode else { return }
        myOrderFreshnessState = .checking
        Task { @MainActor in
            let resolution = await withTaskGroup(of: CriticalDataFreshnessResolution?.self) { group in
                group.addTask {
                    await self.resolveCriticalDataFreshness.execute()
                }
                group.addTask {
                    try? await Task.sleep(nanoseconds: 2_500_000_000)
                    return nil
                }
                let first = await group.next() ?? nil
                group.cancelAll()
                return first
            }
            guard case .authorized(let latestSession) = mode, latestSession == session else { return }
            switch resolution {
            case .fresh:
                myOrderFreshnessState = .ready
            case .invalidConfig:
                myOrderFreshnessState = .unavailable
            case nil:
                myOrderFreshnessState = .timedOut
            }
        }
    }

    func sendPasswordReset() {
        let email = normalizeEmail(recoverEmailInput)
        feedbackMessageKey = nil
        recoverEmailErrorKey = nil

        if email.isEmpty {
            recoverEmailErrorKey = AccessL10nKey.feedbackEmailRequired
            return
        }
        if !isValidEmail(email) {
            recoverEmailErrorKey = AccessL10nKey.feedbackEmailInvalid
            return
        }

        isRecoveringPassword = true
        Task { @MainActor in
            let result = await authSessionProvider.sendPasswordReset(email: email)
            switch result {
            case .success:
                feedbackMessageKey = AccessL10nKey.authInfoPasswordResetSent
            case .failure(let reason):
                applyPasswordResetFailure(reason)
            }
            isRecoveringPassword = false
        }
    }

    func clearFeedbackMessage() {
        feedbackMessageKey = nil
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

    func isValidEmail(_ email: String) -> Bool {
        email.range(
            of: "^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$",
            options: [.regularExpression, .caseInsensitive]
        ) != nil
    }

    func isValidPassword(_ password: String) -> Bool {
        (6...16).contains(password.count)
    }

    func normalizeEmail(_ email: String) -> String {
        email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }
}
