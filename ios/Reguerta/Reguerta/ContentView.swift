import SwiftUI

struct ContentView: View {
    @Environment(\.reguertaTokens) private var tokens
    @State private var viewModel = SessionViewModel()
    @State private var shellState = AuthShellState()
    @State private var splashScale: CGFloat = SplashAnimationContract.initialScale
    @State private var splashRotation: Double = SplashAnimationContract.initialRotation
    @State private var splashOpacity: Double = SplashAnimationContract.initialOpacity
    @State private var didStartSplashAnimation = false

    private var shouldSkipSplash: Bool {
        ProcessInfo.processInfo.arguments.contains("-skipSplash")
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: tokens.spacing.lg) {
                    switch shellState.currentRoute {
                    case .splash:
                        splashRoute
                    case .welcome:
                        welcomeRoute
                    case .login:
                        loginRoute
                    case .register:
                        placeholderRoute(
                            titleKey: AccessL10nKey.registerTitle,
                            subtitleKey: AccessL10nKey.registerSubtitle
                        )
                    case .recoverPassword:
                        placeholderRoute(
                            titleKey: AccessL10nKey.recoverTitle,
                            subtitleKey: AccessL10nKey.recoverSubtitle
                        )
                    case .home:
                        homeRoute
                    }

                    if let feedbackKey = viewModel.feedbackMessageKey {
                        ReguertaCard {
                            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                                ReguertaInlineFeedback(localizedKey(feedbackKey))
                                ReguertaButton(
                                    localizedKey(AccessL10nKey.dismissMessage),
                                    variant: .text,
                                    fullWidth: false
                                ) {
                                    viewModel.clearFeedbackMessage()
                                }
                            }
                        }
                    }
                }
                .padding(tokens.spacing.lg)
            }
            .navigationTitle(routeTitle(for: shellState.currentRoute))
            .toolbar {
                if shellState.canGoBack {
                    ToolbarItem(placement: .topBarLeading) {
                        Button {
                            dispatchShell(.back)
                        } label: {
                            Text(localizedKey(AccessL10nKey.commonBack))
                        }
                    }
                }
            }
        }
        .task(id: shellState.currentRoute) {
            await handleSplashIfNeeded()
        }
        .onChange(of: viewModel.mode) { _, mode in
            if mode.isAuthenticatedSession, shellState.currentRoute != .splash {
                dispatchShell(.sessionAuthenticated)
            }
        }
        .onChange(of: shellState.currentRoute) { _, route in
            if route != .splash {
                resetSplashAnimationState()
            }
        }
    }

    private var splashRoute: some View {
        ReguertaCard {
            VStack(alignment: .center, spacing: tokens.spacing.lg) {
                Text(localizedKey(AccessL10nKey.membersRolesTitle))
                    .font(tokens.typography.titleSection)
                    .foregroundStyle(tokens.colors.textPrimary)
                Image("brand_logo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 120, height: 120)
                    .scaleEffect(splashScale)
                    .rotationEffect(.degrees(splashRotation))
                    .opacity(splashOpacity)
                Text(localizedKey(AccessL10nKey.splashLoading))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
            }
            .frame(maxWidth: .infinity)
            .task(id: shellState.currentRoute) {
                startSplashAnimationIfNeeded()
            }
        }
    }

    private var welcomeRoute: some View {
        ReguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                Text(localizedKey(AccessL10nKey.welcomeTitlePrefix))
                    .font(tokens.typography.titleCard)
                    .foregroundStyle(tokens.colors.textPrimary)
                Text(localizedKey(AccessL10nKey.welcomeTitleBrand))
                    .font(tokens.typography.titleHero)
                    .foregroundStyle(tokens.colors.textPrimary)
                Text(localizedKey(AccessL10nKey.welcomeSubtitle))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
                ReguertaButton(localizedKey(AccessL10nKey.welcomeCtaEnter)) {
                    dispatchShell(.continueFromWelcome)
                }
                HStack(spacing: tokens.spacing.sm) {
                    Text(localizedKey(AccessL10nKey.welcomeNotRegistered))
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)
                    ReguertaButton(
                        localizedKey(AccessL10nKey.welcomeLinkRegister),
                        variant: .text,
                        fullWidth: false
                    ) {
                        dispatchShell(.openRegisterFromWelcome)
                    }
                }
            }
        }
    }

    private var loginRoute: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.md) {
            ReguertaCard {
                VStack(alignment: .leading, spacing: tokens.spacing.md) {
                    Text(localizedKey(AccessL10nKey.loginTitle))
                        .font(tokens.typography.titleCard)
                        .foregroundStyle(tokens.colors.textPrimary)
                    ReguertaInlineFeedback(localizedKey(AccessL10nKey.signedOutHint), kind: .info)
                }
            }

            signInCard

            HStack {
                ReguertaButton(
                    localizedKey(AccessL10nKey.loginLinkRegister),
                    variant: .text,
                    fullWidth: false
                ) {
                    dispatchShell(.openRegisterFromLogin)
                }

                ReguertaButton(
                    localizedKey(AccessL10nKey.loginLinkForgotPassword),
                    variant: .text,
                    fullWidth: false
                ) {
                    dispatchShell(.openRecoverFromLogin)
                }
            }
        }
    }

    private var homeRoute: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.lg) {
            cardContainer {
                HStack {
                    Text(localizedKey(AccessL10nKey.homeTitle))
                        .font(tokens.typography.titleCard)
                    Spacer()
                    Button {
                        viewModel.signOut()
                        dispatchShell(.signedOut)
                    } label: {
                        Text(localizedKey(AccessL10nKey.signOut))
                    }
                }
            }

            switch viewModel.mode {
            case .signedOut:
                Text(localizedKey(AccessL10nKey.signedOutHint))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
            case .unauthorized(let email, let reason):
                unauthorizedCard(email: email, reason: reason)
                operationalModules(enabled: false)
            case .authorized(let session):
                authorizedHome(session: session)
            }
        }
    }

    private var signInCard: some View {
        ReguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                Text(localizedKey(AccessL10nKey.authenticationCardTitle))
                    .font(tokens.typography.titleCard)

                ReguertaInputField(
                    localizedKey(AccessL10nKey.emailLabel),
                    text: binding(\.emailInput),
                    placeholder: localizedKey(AccessL10nKey.emailLabel),
                    helperMessage: localizedKey(AccessL10nKey.signedOutHint),
                    errorMessage: viewModel.emailErrorKey.map(localizedKey),
                    isEnabled: !viewModel.isAuthenticating,
                    keyboardType: .emailAddress
                )

                ReguertaInputField(
                    localizedKey(AccessL10nKey.passwordLabel),
                    text: binding(\.passwordInput),
                    placeholder: localizedKey(AccessL10nKey.passwordLabel),
                    errorMessage: viewModel.passwordErrorKey.map(localizedKey),
                    isEnabled: !viewModel.isAuthenticating,
                    isSecure: true,
                    keyboardType: .default
                )

                ReguertaButton(
                    localizedKey(viewModel.isAuthenticating ? AccessL10nKey.signingIn : AccessL10nKey.signIn),
                    isEnabled: viewModel.canSubmitSignIn,
                    isLoading: viewModel.isAuthenticating
                ) {
                    viewModel.signIn()
                }
            }
        }
    }

    @ViewBuilder
    private func unauthorizedCard(email: String, reason: UnauthorizedReason) -> some View {
        cardContainer {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(localizedKey(AccessL10nKey.unauthorized))
                    .font(tokens.typography.titleCard)
                Text(l10n(AccessL10nKey.signedInEmail, email))
                Text(localizedKey(AccessL10nKey.restrictedModeInfo))
                Text(l10n(AccessL10nKey.reason, localizedUnauthorizedReason(reason)))
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
            }
        }
    }

    @ViewBuilder
    private func authorizedHome(session: AuthorizedSession) -> some View {
        cardContainer {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(l10n(AccessL10nKey.homeWelcome, session.member.displayName))
                Text(l10n(AccessL10nKey.roles, session.member.roles.prettyListLocalized))
                Text(
                    l10n(
                        AccessL10nKey.status,
                        l10n(session.member.isActive ? AccessL10nKey.statusActive : AccessL10nKey.statusInactive)
                    )
                )
            }
        }

        operationalModules(enabled: true)

        if session.member.isAdmin {
            adminMembersCard(session: session)
        }
    }

    @ViewBuilder
    private func operationalModules(enabled: Bool) -> some View {
        cardContainer {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(localizedKey(AccessL10nKey.operationalModulesTitle))
                    .font(tokens.typography.titleCard)
                Button {
                } label: {
                    Text(localizedKey(AccessL10nKey.myOrder))
                }
                .disabled(!enabled)
                Button {
                } label: {
                    Text(localizedKey(AccessL10nKey.catalog))
                }
                .disabled(!enabled)
                Button {
                } label: {
                    Text(localizedKey(AccessL10nKey.shifts))
                }
                .disabled(!enabled)
            }
        }
    }

    @ViewBuilder
    private func adminMembersCard(session: AuthorizedSession) -> some View {
        cardContainer {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                Text(localizedKey(AccessL10nKey.adminManageMembersTitle))
                    .font(tokens.typography.titleCard)
                Text(localizedKey(AccessL10nKey.adminManageMembersSubtitle))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)

                ForEach(session.members) { member in
                    memberRow(member: member)
                }

                Divider()

                Text(localizedKey(AccessL10nKey.adminCreatePreAuthorizedTitle))
                    .font(tokens.typography.titleCard)
                TextField(localizedKey(AccessL10nKey.displayNameLabel), text: draftBinding(\.displayName))
                    .textFieldStyle(.roundedBorder)
                TextField(localizedKey(AccessL10nKey.emailLabel), text: draftBinding(\.email))
                    .textInputAutocapitalization(.never)
                    .textFieldStyle(.roundedBorder)

                Toggle(localizedKey(AccessL10nKey.roleMember), isOn: draftBinding(\.isMember))
                Toggle(localizedKey(AccessL10nKey.roleProducer), isOn: draftBinding(\.isProducer))
                Toggle(localizedKey(AccessL10nKey.roleAdmin), isOn: draftBinding(\.isAdmin))
                Toggle(localizedKey(AccessL10nKey.roleActive), isOn: draftBinding(\.isActive))

                Button {
                    viewModel.createAuthorizedMember()
                } label: {
                    Text(localizedKey(AccessL10nKey.createMember))
                }
            }
        }
    }

    @ViewBuilder
    private func memberRow(member: Member) -> some View {
        VStack(alignment: .leading, spacing: tokens.spacing.xs + 2) {
            Text(member.displayName)
                .font(tokens.typography.bodySecondary.weight(.semibold))
            Text(member.normalizedEmail)
                .font(tokens.typography.bodySecondary)
            Text(l10n(AccessL10nKey.roles, member.roles.prettyListLocalized))
                .font(tokens.typography.label)
            Text(l10n(AccessL10nKey.authLinked, l10n(member.authUid == nil ? AccessL10nKey.no : AccessL10nKey.yes)))
                .font(tokens.typography.label)
            Text(
                l10n(
                    AccessL10nKey.status,
                    l10n(member.isActive ? AccessL10nKey.statusActive : AccessL10nKey.statusInactive)
                )
            )
            .font(tokens.typography.label)

            HStack {
                Button {
                    viewModel.toggleAdmin(memberId: member.id)
                } label: {
                    Text(localizedKey(member.isAdmin ? AccessL10nKey.revokeAdmin : AccessL10nKey.grantAdmin))
                }
                Button {
                    viewModel.toggleActive(memberId: member.id)
                } label: {
                    Text(localizedKey(member.isActive ? AccessL10nKey.deactivate : AccessL10nKey.activate))
                }
            }
        }
        .padding(tokens.spacing.sm + 2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(tokens.colors.surfaceSecondary)
        .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))
    }

    @ViewBuilder
    private func placeholderRoute(titleKey: String, subtitleKey: String) -> some View {
        ReguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                Text(localizedKey(titleKey))
                    .font(tokens.typography.titleSection)
                Text(localizedKey(subtitleKey))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
                ReguertaButton(localizedKey(AccessL10nKey.commonBack)) {
                    dispatchShell(.back)
                }
            }
        }
    }

    @ViewBuilder
    private func cardContainer<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        content()
            .padding(tokens.spacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(tokens.colors.surfacePrimary)
            .overlay(
                RoundedRectangle(cornerRadius: tokens.radius.md)
                    .stroke(tokens.colors.borderSubtle, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: tokens.radius.md))
    }

    private func binding(_ keyPath: ReferenceWritableKeyPath<SessionViewModel, String>) -> Binding<String> {
        Binding(
            get: { viewModel[keyPath: keyPath] },
            set: { viewModel[keyPath: keyPath] = $0 }
        )
    }

    private func draftBinding(_ keyPath: WritableKeyPath<MemberDraft, String>) -> Binding<String> {
        Binding(
            get: { viewModel.memberDraft[keyPath: keyPath] },
            set: {
                var updated = viewModel.memberDraft
                updated[keyPath: keyPath] = $0
                viewModel.memberDraft = updated
            }
        )
    }

    private func draftBinding(_ keyPath: WritableKeyPath<MemberDraft, Bool>) -> Binding<Bool> {
        Binding(
            get: { viewModel.memberDraft[keyPath: keyPath] },
            set: {
                var updated = viewModel.memberDraft
                updated[keyPath: keyPath] = $0
                viewModel.memberDraft = updated
            }
        )
    }

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }

    private func dispatchShell(_ action: AuthShellAction) {
        shellState = reduceAuthShell(state: shellState, action: action)
    }

    private func handleSplashIfNeeded() async {
        guard shellState.currentRoute == .splash else { return }

        if shouldSkipSplash {
            dispatchShell(.splashCompleted(isAuthenticated: viewModel.mode.isAuthenticatedSession))
            return
        }

        try? await Task.sleep(nanoseconds: SplashAnimationContract.durationNanoseconds)
        guard shellState.currentRoute == .splash else { return }
        dispatchShell(.splashCompleted(isAuthenticated: viewModel.mode.isAuthenticatedSession))
    }

    @MainActor
    private func startSplashAnimationIfNeeded() {
        guard shellState.currentRoute == .splash else { return }
        guard !shouldSkipSplash else { return }
        guard !didStartSplashAnimation else { return }
        didStartSplashAnimation = true

        withAnimation(.easeInOut(duration: SplashAnimationContract.durationSeconds)) {
            splashScale = SplashAnimationContract.finalScale
            splashRotation = SplashAnimationContract.finalRotation
            splashOpacity = SplashAnimationContract.finalOpacity
        }
    }

    @MainActor
    private func resetSplashAnimationState() {
        didStartSplashAnimation = false
        splashScale = SplashAnimationContract.initialScale
        splashRotation = SplashAnimationContract.initialRotation
        splashOpacity = SplashAnimationContract.initialOpacity
    }

    private func routeTitle(for route: AuthShellRoute) -> LocalizedStringKey {
        switch route {
        case .splash, .welcome:
            return localizedKey(AccessL10nKey.brandReguerta)
        case .login:
            return localizedKey(AccessL10nKey.loginTitle)
        case .register:
            return localizedKey(AccessL10nKey.registerTitle)
        case .recoverPassword:
            return localizedKey(AccessL10nKey.recoverTitle)
        case .home:
            return localizedKey(AccessL10nKey.homeTitle)
        }
    }
}

private extension Set<MemberRole> {
    var prettyListLocalized: String {
        sorted { lhs, rhs in lhs.rawValue < rhs.rawValue }
            .map(localizedRoleValue(_:))
            .joined(separator: ", ")
    }
}

#Preview {
    ContentView()
}

private enum SplashAnimationContract {
    static let durationSeconds: Double = 1.5
    static let durationNanoseconds: UInt64 = 1_500_000_000
    static let initialScale: CGFloat = 0.84
    static let finalScale: CGFloat = 1.34
    static let initialRotation: Double = -6
    static let finalRotation: Double = 8
    static let initialOpacity: Double = 0.94
    static let finalOpacity: Double = 0.0
}
