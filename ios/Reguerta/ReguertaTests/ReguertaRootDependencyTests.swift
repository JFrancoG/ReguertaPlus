import Testing

@testable import Reguerta

@MainActor
struct ReguertaRootDependencyTests {
    @Test
    func previewEnvironmentSharesSessionWithRootCoordinator() {
        let environment = ReguertaAppEnvironment.preview()

        #expect(environment.accessRootViewModel.feedbackCenter === environment.feedbackCenter)
        #expect(environment.sessionViewModel.feedbackCenter === environment.feedbackCenter)
        #expect(environment.accessRootViewModel.sessionViewModel === environment.sessionViewModel)
        #expect(environment.accessRootViewModel.installedVersion == "0.0.0-preview")
        #expect(environment.sessionViewModel.mode == .signedOut)
    }

    @Test
    func previewDependenciesCreateSignedOutSessionWithoutLiveBootstrap() {
        let viewModel = SessionViewModel(dependencies: .preview())

        #expect(viewModel.mode == .signedOut)
        #expect(viewModel.isDevelopImpersonationEnabled == false)
    }

    @Test
    func rootCoordinatorSkipsSplashToWelcomeWhenLaunchArgumentRequestsIt() async {
        let rootViewModel = makeRootViewModel(shouldSkipSplash: true)

        await rootViewModel.handleSplashIfNeeded()

        #expect(rootViewModel.splashDelayCompleted)
        #expect(rootViewModel.startupGateState == .optionalDismissed)
        #expect(rootViewModel.shellState.currentRoute == .welcome)
    }

    @Test
    func rootCoordinatorBlocksSplashWhenStartupGateRequiresForcedUpdate() async {
        let rootViewModel = makeRootViewModel(
            startupPolicy: StartupVersionPolicy(
                currentVersion: "2.0.0",
                minimumVersion: "2.0.0",
                forceUpdate: true,
                storeURL: "https://apps.apple.com/app/reguerta"
            ),
            installedVersion: "1.0.0"
        )
        rootViewModel.splashDelayCompleted = true

        await rootViewModel.evaluateStartupGateIfNeeded()

        #expect(rootViewModel.startupGateState == .forcedUpdate(storeURL: "https://apps.apple.com/app/reguerta"))
        #expect(rootViewModel.shellState.currentRoute == .splash)
    }

    @Test
    func rootCoordinatorRoutesAuthenticatedSessionToHomeOutsideSplash() {
        let rootViewModel = makeRootViewModel()
        let currentMember = Member(
            id: "member_root",
            displayName: "Root Member",
            normalizedEmail: "root@reguerta.test",
            authUid: "auth_root",
            roles: [.member],
            isActive: true,
            producerCatalogEnabled: true
        )
        rootViewModel.shellState = AuthShellState(backStack: [.welcome, .login])
        rootViewModel.sessionViewModel.mode = .authorized(
            AuthorizedSession(
                principal: AuthPrincipal(uid: "auth_root", email: "root@reguerta.test"),
                authenticatedMember: currentMember,
                member: currentMember,
                members: [currentMember]
            )
        )

        rootViewModel.handleSessionModeChange(rootViewModel.sessionViewModel.mode)

        #expect(rootViewModel.shellState.currentRoute == .home)
        #expect(rootViewModel.shellState.canGoBack == false)
    }

    @Test
    func rootCoordinatorRoutesSignedOutSessionToWelcomeOutsideSplash() {
        let rootViewModel = makeRootViewModel()
        rootViewModel.shellState = AuthShellState(backStack: [.home])
        rootViewModel.sessionViewModel.mode = .signedOut

        rootViewModel.handleSessionModeChange(rootViewModel.sessionViewModel.mode)

        #expect(rootViewModel.shellState.currentRoute == .welcome)
        #expect(rootViewModel.shellState.canGoBack == false)
    }

    @Test
    func homeDrawerSignOutRequestsConfirmationWithoutEndingSession() {
        let rootViewModel = makeRootViewModel()
        rootViewModel.shellState = AuthShellState(backStack: [.home])
        rootViewModel.sessionViewModel.mode = .authorized(makeAuthorizedSession())
        rootViewModel.isHomeDrawerOpen = true

        rootViewModel.handleHomeDrawerSignOut()

        #expect(rootViewModel.showsHomeSignOutDialog)
        #expect(rootViewModel.isHomeDrawerOpen == false)
        #expect(rootViewModel.shellState.currentRoute == .home)
        guard case .authorized = rootViewModel.sessionViewModel.mode else {
            Issue.record("Drawer sign-out should wait for explicit confirmation")
            return
        }

        rootViewModel.dismissHomeDrawerSignOutDialog()

        #expect(rootViewModel.showsHomeSignOutDialog == false)
        guard case .authorized = rootViewModel.sessionViewModel.mode else {
            Issue.record("Dismissing the dialog should keep the session active")
            return
        }
    }

    @Test
    func homeDrawerSignOutConfirmationSignsOutAndRoutesWelcome() {
        let rootViewModel = makeRootViewModel()
        rootViewModel.shellState = AuthShellState(backStack: [.home])
        rootViewModel.sessionViewModel.mode = .authorized(makeAuthorizedSession())
        rootViewModel.showsHomeSignOutDialog = true

        rootViewModel.confirmHomeDrawerSignOut()

        #expect(rootViewModel.showsHomeSignOutDialog == false)
        #expect(rootViewModel.homeDestination == .dashboard)
        #expect(rootViewModel.sessionViewModel.mode == .signedOut)
        #expect(rootViewModel.shellState.currentRoute == .welcome)
        #expect(rootViewModel.shellState.canGoBack == false)
    }

    private func makeRootViewModel(
        startupPolicy: StartupVersionPolicy? = nil,
        shouldSkipSplash: Bool = false,
        installedVersion: String = "1.0.0"
    ) -> AccessRootViewModel {
        AccessRootViewModel(
            sessionViewModel: SessionViewModel(dependencies: .preview()),
            startupVersionGateUseCase: ResolveStartupVersionGateUseCase(
                repository: FixedStartupVersionPolicyRepository(policy: startupPolicy)
            ),
            shouldSkipSplashProvider: { shouldSkipSplash },
            installedVersionProvider: { installedVersion }
        )
    }

    private func makeAuthorizedSession() -> AuthorizedSession {
        let member = Member(
            id: "member_root",
            displayName: "Root Member",
            normalizedEmail: "root@reguerta.test",
            authUid: "auth_root",
            roles: [.member],
            isActive: true,
            producerCatalogEnabled: true
        )
        return AuthorizedSession(
            principal: AuthPrincipal(uid: "auth_root", email: "root@reguerta.test"),
            authenticatedMember: member,
            member: member,
            members: [member]
        )
    }
}
