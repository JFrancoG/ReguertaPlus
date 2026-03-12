import SwiftUI

struct ContentView: View {
    @State private var viewModel = SessionViewModel()
    @State private var shellState = AuthShellState()

    private var shouldSkipSplash: Bool {
        ProcessInfo.processInfo.arguments.contains("-skipSplash")
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
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
                        Text(l10n(feedbackKey))
                            .font(.footnote)
                            .foregroundStyle(.red)
                        Button {
                            viewModel.clearFeedbackMessage()
                        } label: {
                            Text(localizedKey(AccessL10nKey.dismissMessage))
                        }
                    }
                }
                .padding()
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
    }

    private var splashRoute: some View {
        cardContainer {
            VStack(alignment: .center, spacing: 16) {
                Text(localizedKey(AccessL10nKey.membersRolesTitle))
                    .font(.title2.bold())
                ProgressView()
                Text(localizedKey(AccessL10nKey.splashLoading))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity)
        }
    }

    private var welcomeRoute: some View {
        cardContainer {
            VStack(alignment: .leading, spacing: 12) {
                Text(localizedKey(AccessL10nKey.welcomeTitlePrefix))
                    .font(.headline)
                Text(localizedKey(AccessL10nKey.welcomeTitleBrand))
                    .font(.title.bold())
                Text(localizedKey(AccessL10nKey.welcomeSubtitle))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Button {
                    dispatchShell(.continueFromWelcome)
                } label: {
                    Text(localizedKey(AccessL10nKey.welcomeCtaEnter))
                }
                .buttonStyle(.borderedProminent)
            }
        }
    }

    private var loginRoute: some View {
        VStack(alignment: .leading, spacing: 12) {
            cardContainer {
                VStack(alignment: .leading, spacing: 12) {
                    Text(localizedKey(AccessL10nKey.loginTitle))
                        .font(.headline)
                    Text(localizedKey(AccessL10nKey.signedOutHint))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }

            signInCard

            HStack {
                Button {
                    dispatchShell(.openRegisterFromLogin)
                } label: {
                    Text(localizedKey(AccessL10nKey.loginLinkRegister))
                }

                Button {
                    dispatchShell(.openRecoverFromLogin)
                } label: {
                    Text(localizedKey(AccessL10nKey.loginLinkForgotPassword))
                }
            }
            .buttonStyle(.plain)
        }
    }

    private var homeRoute: some View {
        VStack(alignment: .leading, spacing: 16) {
            cardContainer {
                HStack {
                    Text(localizedKey(AccessL10nKey.homeTitle))
                        .font(.headline)
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
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            case .unauthorized(let email, let reason):
                unauthorizedCard(email: email, reason: reason)
                operationalModules(enabled: false)
            case .authorized(let session):
                authorizedHome(session: session)
            }
        }
    }

    private var signInCard: some View {
        cardContainer {
            VStack(alignment: .leading, spacing: 12) {
                Text(localizedKey(AccessL10nKey.authenticationCardTitle))
                    .font(.headline)

                TextField(localizedKey(AccessL10nKey.emailLabel), text: binding(\.emailInput))
                    .textInputAutocapitalization(.never)
                    .textFieldStyle(.roundedBorder)
                TextField(localizedKey(AccessL10nKey.authUidLabel), text: binding(\.uidInput))
                    .textInputAutocapitalization(.never)
                    .textFieldStyle(.roundedBorder)

                Button {
                    viewModel.signIn()
                } label: {
                    Text(localizedKey(viewModel.isAuthenticating ? AccessL10nKey.signingIn : AccessL10nKey.signIn))
                }
                .disabled(viewModel.isAuthenticating)
            }
        }
    }

    @ViewBuilder
    private func unauthorizedCard(email: String, reason: UnauthorizedReason) -> some View {
        cardContainer {
            VStack(alignment: .leading, spacing: 8) {
                Text(localizedKey(AccessL10nKey.unauthorized))
                    .font(.headline)
                Text(l10n(AccessL10nKey.signedInEmail, email))
                Text(localizedKey(AccessL10nKey.restrictedModeInfo))
                Text(l10n(AccessL10nKey.reason, localizedUnauthorizedReason(reason)))
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private func authorizedHome(session: AuthorizedSession) -> some View {
        cardContainer {
            VStack(alignment: .leading, spacing: 8) {
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
            VStack(alignment: .leading, spacing: 10) {
                Text(localizedKey(AccessL10nKey.operationalModulesTitle))
                    .font(.headline)
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
            VStack(alignment: .leading, spacing: 12) {
                Text(localizedKey(AccessL10nKey.adminManageMembersTitle))
                    .font(.headline)
                Text(localizedKey(AccessL10nKey.adminManageMembersSubtitle))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                ForEach(session.members) { member in
                    memberRow(member: member)
                }

                Divider()

                Text(localizedKey(AccessL10nKey.adminCreatePreAuthorizedTitle))
                    .font(.headline)
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
        VStack(alignment: .leading, spacing: 6) {
            Text(member.displayName)
                .font(.subheadline.bold())
            Text(member.normalizedEmail)
                .font(.subheadline)
            Text(l10n(AccessL10nKey.roles, member.roles.prettyListLocalized))
                .font(.footnote)
            Text(l10n(AccessL10nKey.authLinked, l10n(member.authUid == nil ? AccessL10nKey.no : AccessL10nKey.yes)))
                .font(.footnote)
            Text(
                l10n(
                    AccessL10nKey.status,
                    l10n(member.isActive ? AccessL10nKey.statusActive : AccessL10nKey.statusInactive)
                )
            )
            .font(.footnote)

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
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    @ViewBuilder
    private func placeholderRoute(titleKey: String, subtitleKey: String) -> some View {
        cardContainer {
            VStack(alignment: .leading, spacing: 12) {
                Text(localizedKey(titleKey))
                    .font(.title3.bold())
                Text(localizedKey(subtitleKey))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Button {
                    dispatchShell(.back)
                } label: {
                    Text(localizedKey(AccessL10nKey.commonBack))
                }
            }
        }
    }

    @ViewBuilder
    private func cardContainer<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        content()
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.systemBackground))
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(Color(.separator), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 14))
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

        try? await Task.sleep(nanoseconds: 1_200_000_000)
        guard shellState.currentRoute == .splash else { return }
        dispatchShell(.splashCompleted(isAuthenticated: viewModel.mode.isAuthenticatedSession))
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
