import SwiftUI

struct ContentView: View {
    @State private var viewModel = SessionViewModel()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Members and Roles")
                        .font(.title2.bold())

                    signInCard

                    switch viewModel.mode {
                    case .signedOut:
                        Text("Sign in with a pre-authorized member email to unlock operational modules.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    case .unauthorized(let email, let message):
                        unauthorizedCard(email: email, message: message)
                        operationalModules(enabled: false)
                    case .authorized(let session):
                        authorizedHome(session: session)
                    }

                    if let feedback = viewModel.feedbackMessage {
                        Text(feedback)
                            .font(.footnote)
                            .foregroundStyle(.red)
                        Button("Dismiss message") {
                            viewModel.clearFeedbackMessage()
                        }
                    }
                }
                .padding()
            }
            .navigationTitle("Reguerta")
        }
    }

    private var signInCard: some View {
        cardContainer {
            VStack(alignment: .leading, spacing: 12) {
                Text("Authentication")
                    .font(.headline)

                TextField("Email", text: binding(\.emailInput))
                    .textInputAutocapitalization(.never)
                    .textFieldStyle(.roundedBorder)
                TextField("Auth UID", text: binding(\.uidInput))
                    .textInputAutocapitalization(.never)
                    .textFieldStyle(.roundedBorder)

                HStack {
                    Button(viewModel.isAuthenticating ? "Signing in..." : "Sign in") {
                        viewModel.signIn()
                    }
                    .disabled(viewModel.isAuthenticating)

                    Button("Sign out") {
                        viewModel.signOut()
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func unauthorizedCard(email: String, message: String) -> some View {
        cardContainer {
            VStack(alignment: .leading, spacing: 8) {
                Text("Unauthorized user")
                    .font(.headline)
                Text("Signed in email: \(email)")
                Text("Operational modules remain disabled until an admin pre-authorizes this email.")
                Text("Reason: \(message)")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private func authorizedHome(session: AuthorizedSession) -> some View {
        cardContainer {
            VStack(alignment: .leading, spacing: 8) {
                Text("Home")
                    .font(.headline)
                Text("Welcome \(session.member.displayName)")
                Text("Roles: \(session.member.roles.prettyList)")
                Text("Status: \(session.member.isActive ? "Active" : "Inactive")")
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
                Text("Operational modules")
                    .font(.headline)
                Button("My order") {}
                    .disabled(!enabled)
                Button("Catalog") {}
                    .disabled(!enabled)
                Button("Shifts") {}
                    .disabled(!enabled)
            }
        }
    }

    @ViewBuilder
    private func adminMembersCard(session: AuthorizedSession) -> some View {
        cardContainer {
            VStack(alignment: .leading, spacing: 12) {
                Text("Admin | Manage members")
                    .font(.headline)
                Text("Create / edit / deactivate members and roles")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                ForEach(session.members) { member in
                    memberRow(member: member)
                }

                Divider()

                Text("Create pre-authorized member")
                    .font(.headline)
                TextField("Display name", text: draftBinding(\.displayName))
                    .textFieldStyle(.roundedBorder)
                TextField("Email", text: draftBinding(\.email))
                    .textInputAutocapitalization(.never)
                    .textFieldStyle(.roundedBorder)

                Toggle("Member", isOn: draftBinding(\.isMember))
                Toggle("Producer", isOn: draftBinding(\.isProducer))
                Toggle("Admin", isOn: draftBinding(\.isAdmin))
                Toggle("Active", isOn: draftBinding(\.isActive))

                Button("Create member") {
                    viewModel.createAuthorizedMember()
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
            Text("Roles: \(member.roles.prettyList)")
                .font(.footnote)
            Text("Auth linked: \(member.authUid == nil ? "No" : "Yes")")
                .font(.footnote)
            Text("Status: \(member.isActive ? "Active" : "Inactive")")
                .font(.footnote)

            HStack {
                Button(member.isAdmin ? "Revoke admin" : "Grant admin") {
                    viewModel.toggleAdmin(memberId: member.id)
                }
                Button(member.isActive ? "Deactivate" : "Activate") {
                    viewModel.toggleActive(memberId: member.id)
                }
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 10))
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
}

private extension Set<MemberRole> {
    var prettyList: String {
        sorted { lhs, rhs in lhs.rawValue < rhs.rawValue }
            .map(\.rawValue)
            .joined(separator: ", ")
    }
}

#Preview {
    ContentView()
}
