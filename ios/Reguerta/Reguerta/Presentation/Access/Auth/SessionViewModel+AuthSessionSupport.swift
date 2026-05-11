import Foundation

extension SessionViewModel {
    private struct AuthorizedSessionBootstrapData {
        let products: [Product]
        let allNotifications: [NotificationEvent]
        let profiles: [SharedProfile]
        let shifts: [ShiftAssignment]
        let requests: [ShiftSwapRequest]
        let allNews: [NewsArticle]
    }

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
        resetSessionContentState()
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

    func resetSessionContentState() {
        latestNews = []
        newsFeed = []
        newsDraft = NewsDraft()
        notificationsFeed = []
        notificationDraft = NotificationDraft()
        productsFeed = []
        myOrderProductsFeed = []
        myOrderSeasonalCommitmentsFeed = []
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
        isUploadingNewsImage = false
        isLoadingNotifications = false
        isSendingNotification = false
        isLoadingProducts = false
        isLoadingMyOrderProducts = false
        isSavingProduct = false
        isUploadingProductImage = false
        isUpdatingProducerCatalogVisibility = false
        isLoadingSharedProfiles = false
        isSavingSharedProfile = false
        isUploadingSharedProfileImage = false
        isDeletingSharedProfile = false
        isLoadingShifts = false
        isSavingShiftSwapRequest = false
        isUpdatingShiftSwapRequest = false
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
        setAuthorizedLoadingState(member: member)
        let bootstrapData = await loadAuthorizedSessionBootstrapData(member: member)
        applyAuthorizedSessionBootstrapData(bootstrapData, member: member)
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
        resetSessionContentState()
    }

    private func setAuthorizedLoadingState(member: Member) {
        isLoadingNews = true
        isLoadingNotifications = true
        isLoadingProducts = member.canManageProductCatalog
        isLoadingMyOrderProducts = false
        isLoadingSharedProfiles = true
        isLoadingShifts = true
    }

    private func loadAuthorizedSessionBootstrapData(member: Member) async -> AuthorizedSessionBootstrapData {
        async let products = productRepository.products(vendorId: member.id)
        async let allNotifications = notificationRepository.allNotifications()
        async let profiles = sharedProfileRepository.allSharedProfiles()
        async let shifts = shiftRepository.allShifts()
        async let requests = shiftSwapRequestRepository.allShiftSwapRequests()
        async let allNews = newsRepository.allNews()

        return await AuthorizedSessionBootstrapData(
            products: products,
            allNotifications: allNotifications,
            profiles: profiles,
            shifts: shifts,
            requests: requests,
            allNews: allNews
        )
    }

    private func applyAuthorizedSessionBootstrapData(_ data: AuthorizedSessionBootstrapData, member: Member) {
        latestNews = data.allNews.filter(\.active).prefix(3).map { $0 }
        newsFeed = member.isAdmin ? data.allNews : data.allNews.filter(\.active)
        notificationsFeed = data.allNotifications.filter { $0.isVisible(to: member) }
        productsFeed = data.products
        myOrderProductsFeed = []
        myOrderSeasonalCommitmentsFeed = []
        productDraft = ProductDraft()
        sharedProfiles = data.profiles.filter(\.hasVisibleContent)
        sharedProfileDraft = data.profiles.first(where: { $0.userId == member.id })?.toDraft() ?? SharedProfileDraft()
        shiftsFeed = data.shifts
        shiftSwapRequests = data.requests.visible(to: member.id)
        shiftSwapDraft = ShiftSwapDraft()
        nextDeliveryShift = data.shifts.nextAssignedShift(
            memberId: member.id,
            type: .delivery,
            nowMillis: nowMillisProvider()
        )
        nextMarketShift = data.shifts.nextAssignedShift(
            memberId: member.id,
            type: .market,
            nowMillis: nowMillisProvider()
        )
        editingProductId = nil
        isLoadingNews = false
        isLoadingNotifications = false
        isLoadingProducts = false
        isLoadingMyOrderProducts = false
        isLoadingSharedProfiles = false
        isLoadingShifts = false
    }

    private func shouldShowUnauthorizedDialog(for email: String, reason: UnauthorizedReason) -> Bool {
        guard reason == .userNotFoundInAuthorizedUsers else { return false }
        if case .unauthorized(let currentEmail, _) = mode {
            return currentEmail != email
        }
        return true
    }
}
