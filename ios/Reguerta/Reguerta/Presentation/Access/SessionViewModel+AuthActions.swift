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
        Task {
            await KeyManager.shared.remove(.authorizedMemberId)
        }
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
        isAuthenticating = false
        isRegistering = false
        isRecoveringPassword = false
        showSessionExpiredDialog = false
        showUnauthorizedDialog = false
        feedbackMessageKey = nil
        mode = .signedOut
        memberDraft = MemberDraft()
        myOrderFreshnessState = .idle
        latestNews = []
        newsFeed = []
        newsDraft = NewsDraft()
        notificationsFeed = []
        notificationDraft = NotificationDraft()
        productsFeed = []
        productDraft = ProductDraft()
        sharedProfiles = []
        sharedProfileDraft = SharedProfileDraft()
        shiftsFeed = []
        shiftSwapRequests = []
        shiftSwapDraft = ShiftSwapDraft()
        nextDeliveryShift = nil
        nextMarketShift = nil
        editingProductId = nil
        editingNewsId = nil
        isLoadingNews = false
        isSavingNews = false
        isLoadingNotifications = false
        isSendingNotification = false
        isLoadingProducts = false
        isSavingProduct = false
        isLoadingSharedProfiles = false
        isSavingSharedProfile = false
        isDeletingSharedProfile = false
        isLoadingShifts = false
        isSavingShiftSwapRequest = false
        isUpdatingShiftSwapRequest = false
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
        dismissedShiftSwapRequestIds = []
        shiftSwapDraft = ShiftSwapDraft()
        refreshNews()
        refreshNotifications()
        refreshProducts()
        refreshSharedProfiles()
        refreshShifts()
        refreshDeliveryCalendar()
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
        dismissedShiftSwapRequestIds = []
        shiftSwapDraft = ShiftSwapDraft()
        refreshNews()
        refreshNotifications()
        refreshProducts()
        refreshSharedProfiles()
        refreshShifts()
        refreshDeliveryCalendar()
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
        guard case .authorized(let session) = mode else {
            return
        }

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

            guard case .authorized(let latestSession) = mode, latestSession == session else {
                return
            }

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

    private func validateSignInInputs(email: String, password: String) -> Bool {
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

    private func validateSignUpInputs(email: String, password: String, repeatedPassword: String) -> Bool {
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

    private func applySignInFailure(_ reason: AuthSignInFailureReason) {
        let mapped = mapAuthFailure(reason, flow: .signIn)
        emailErrorKey = mapped.emailErrorKey
        passwordErrorKey = mapped.passwordErrorKey
        feedbackMessageKey = mapped.globalMessageKey
    }

    private func applySignUpFailure(_ reason: AuthSignInFailureReason) {
        let mapped = mapAuthFailure(reason, flow: .signUp)
        registerEmailErrorKey = mapped.emailErrorKey
        registerPasswordErrorKey = mapped.passwordErrorKey
        feedbackMessageKey = mapped.globalMessageKey
    }

    private func applyPasswordResetFailure(_ reason: AuthSignInFailureReason) {
        let mapped = mapAuthFailure(reason, flow: .passwordReset)
        recoverEmailErrorKey = mapped.emailErrorKey
        feedbackMessageKey = mapped.globalMessageKey
    }

    private func applyAuthorizedSession(
        principal: AuthPrincipal,
        shouldRefreshCriticalData: Bool = true
    ) async {
        let result = await resolveAuthorizedSession.execute(authPrincipal: principal)
        switch result {
        case .authorized(let member):
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
            isLoadingNews = true
            isLoadingNotifications = true
            isLoadingProducts = member.canManageProductCatalog
            isLoadingSharedProfiles = true
            isLoadingShifts = true
            let products = await productRepository.products(vendorId: member.id)
            let allNotifications = await notificationRepository.allNotifications()
            let profiles = await sharedProfileRepository.allSharedProfiles()
            let shifts = await shiftRepository.allShifts()
            let requests = await shiftSwapRequestRepository.allShiftSwapRequests()
            let allNews = await newsRepository.allNews()
            latestNews = allNews.filter(\.active).prefix(3).map { $0 }
            newsFeed = member.isAdmin ? allNews : allNews.filter(\.active)
            notificationsFeed = allNotifications.filter { $0.isVisible(to: member) }
            productsFeed = products
            productDraft = ProductDraft()
            sharedProfiles = profiles.filter(\.hasVisibleContent)
            sharedProfileDraft = profiles.first(where: { $0.userId == member.id })?.toDraft() ?? SharedProfileDraft()
            shiftsFeed = shifts
            shiftSwapRequests = requests.visible(to: member.id)
            shiftSwapDraft = ShiftSwapDraft()
            nextDeliveryShift = shifts.nextAssignedShift(
                memberId: member.id,
                type: .delivery,
                nowMillis: nowMillisProvider()
            )
            nextMarketShift = shifts.nextAssignedShift(
                memberId: member.id,
                type: .market,
                nowMillis: nowMillisProvider()
            )
            editingProductId = nil
            isLoadingNews = false
            isLoadingNotifications = false
            isLoadingProducts = false
            isLoadingSharedProfiles = false
            isLoadingShifts = false
            await authorizedDeviceRegistrar.register(member: member)
        case .unauthorized(let reason):
            let shouldShowUnauthorizedDialog = shouldShowUnauthorizedDialog(
                for: principal.email,
                reason: reason
            )
            mode = .unauthorized(email: principal.email, reason: reason)
            showSessionExpiredDialog = false
            showUnauthorizedDialog = shouldShowUnauthorizedDialog
            myOrderFreshnessState = .idle
            latestNews = []
            newsFeed = []
            newsDraft = NewsDraft()
            notificationsFeed = []
            notificationDraft = NotificationDraft()
            productsFeed = []
            productDraft = ProductDraft()
            sharedProfiles = []
            sharedProfileDraft = SharedProfileDraft()
            shiftsFeed = []
            shiftSwapRequests = []
            shiftSwapDraft = ShiftSwapDraft()
            nextDeliveryShift = nil
            nextMarketShift = nil
            editingProductId = nil
            editingNewsId = nil
            isLoadingNews = false
            isSavingNews = false
            isLoadingNotifications = false
            isSendingNotification = false
            isLoadingProducts = false
            isSavingProduct = false
            isLoadingSharedProfiles = false
            isSavingSharedProfile = false
            isDeletingSharedProfile = false
            isLoadingShifts = false
            isSavingShiftSwapRequest = false
            isUpdatingShiftSwapRequest = false
        }
    }

    private func shouldRefreshCriticalData(for principal: AuthPrincipal) -> Bool {
        switch mode {
        case .signedOut:
            return true
        case .unauthorized(let email, _):
            return email != principal.email
        case .authorized(let session):
            return session.principal.uid != principal.uid
        }
    }

    private func shouldShowUnauthorizedDialog(for email: String, reason: UnauthorizedReason) -> Bool {
        guard reason == .userNotFoundInAuthorizedUsers else {
            return false
        }
        if case .unauthorized(let currentEmail, _) = mode {
            return currentEmail != email
        }
        return true
    }

    private func handleExpiredSession() async {
        clearSessionRefreshTracking()
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
        isAuthenticating = false
        isRegistering = false
        isRecoveringPassword = false
        feedbackMessageKey = nil
        mode = .signedOut
        memberDraft = MemberDraft()
        myOrderFreshnessState = .idle
        showSessionExpiredDialog = true
        showUnauthorizedDialog = false
        latestNews = []
        newsFeed = []
        newsDraft = NewsDraft()
        notificationsFeed = []
        notificationDraft = NotificationDraft()
        productsFeed = []
        productDraft = ProductDraft()
        sharedProfiles = []
        sharedProfileDraft = SharedProfileDraft()
        shiftsFeed = []
        shiftSwapRequests = []
        shiftSwapDraft = ShiftSwapDraft()
        nextDeliveryShift = nil
        nextMarketShift = nil
        editingProductId = nil
        editingNewsId = nil
        isLoadingNews = false
        isSavingNews = false
        isLoadingNotifications = false
        isSendingNotification = false
        isLoadingProducts = false
        isSavingProduct = false
        isUpdatingProducerCatalogVisibility = false
        isLoadingSharedProfiles = false
        isSavingSharedProfile = false
        isDeletingSharedProfile = false
        isLoadingShifts = false
        isSavingShiftSwapRequest = false
        isUpdatingShiftSwapRequest = false
        await criticalDataFreshnessLocalRepository.clear()
    }

    private func clearSessionRefreshTracking() {
        lastSessionRefreshAtMillis = nil
        isSessionRefreshInFlight = false
    }

    private func persistMember(target: Member, session: AuthorizedSession) async {
        do {
            let updated = try await upsertMemberByAdmin.execute(
                actorAuthUid: session.principal.uid,
                target: target
            )
            let members = await repository.allMembers()
            let refreshedCurrent = updated.id == session.member.id ? updated : session.member
            let refreshedAuthenticated = updated.id == session.authenticatedMember.id ? updated : session.authenticatedMember
            mode = .authorized(
                AuthorizedSession(
                    principal: session.principal,
                    authenticatedMember: refreshedAuthenticated,
                    member: refreshedCurrent,
                    members: members
                )
            )
        } catch MemberManagementError.accessDenied {
            feedbackMessageKey = AccessL10nKey.feedbackOnlyAdminManageMembers
        } catch MemberManagementError.lastAdminRemoval {
            feedbackMessageKey = AccessL10nKey.feedbackCannotRemoveLastAdmin
        } catch {
            feedbackMessageKey = AccessL10nKey.feedbackUnableSaveChanges
        }
    }

    func normalizeEmail(_ email: String) -> String {
        email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }
}
