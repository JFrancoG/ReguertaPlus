import Testing

@testable import Reguerta

@MainActor
struct ReguertaRootDependencyTests {
    @Test
    func previewEnvironmentSharesSessionWithRootCoordinator() {
        let environment = ReguertaAppEnvironment.preview()

        #expect(environment.accessRootViewModel.sessionViewModel === environment.sessionViewModel)
        #expect(environment.accessRootViewModel.installedVersion == "0.0.0-preview")
        #expect(environment.sessionViewModel.mode == .signedOut)
    }

    @Test
    func previewDependenciesCreateSignedOutSessionWithoutLiveBootstrap() {
        let viewModel = SessionViewModel(dependencies: .preview())

        #expect(viewModel.mode == .signedOut)
        #expect(viewModel.isDevelopImpersonationEnabled == false)
        #expect(viewModel.nowOverrideMillis == nil)
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
}
