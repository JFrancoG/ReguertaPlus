import SwiftUI

struct UsersRouteView: View {
    let tokens: ReguertaDesignTokens
    let viewModel: SessionViewModel
    let session: AuthorizedSession
    @Binding var memberDraft: MemberDraft

    @State private var isEditorOpen = false
    @State private var editingMemberId: String?
    @State private var pendingToggleActiveMemberId: String?

    private var canManageMembers: Bool {
        session.member.canManageMembers
    }

    private var sortedMembers: [Member] {
        session.members.sorted {
            $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending
        }
    }

    private var editingMember: Member? {
        guard let editingMemberId else { return nil }
        return sortedMembers.first(where: { $0.id == editingMemberId })
    }

    private var pendingToggleMember: Member? {
        guard let pendingToggleActiveMemberId else { return nil }
        return sortedMembers.first(where: { $0.id == pendingToggleActiveMemberId })
    }

    var body: some View {
        ZStack {
            Group {
                if isEditorOpen && canManageMembers {
                    usersEditor
                } else {
                    usersList
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

            if let member = pendingToggleMember {
                ReguertaDialog(
                    type: member.isActive ? .error : .info,
                    title: l10n(
                        member.isActive
                            ? AccessL10nKey.usersToggleActiveAlertTitleDeactivate
                            : AccessL10nKey.usersToggleActiveAlertTitleActivate
                    ),
                    message: member.isActive
                        ? l10n(AccessL10nKey.usersToggleActiveAlertMessageDeactivate, member.displayName)
                        : l10n(AccessL10nKey.usersToggleActiveAlertMessageActivate, member.displayName),
                    primaryAction: ReguertaDialogAction(
                        title: AccessL10nKey.commonAccept,
                        action: {
                            viewModel.toggleActive(memberId: member.id)
                            pendingToggleActiveMemberId = nil
                        }
                    ),
                    secondaryAction: ReguertaDialogAction(
                        title: AccessL10nKey.commonActionCancel,
                        action: { pendingToggleActiveMemberId = nil }
                    ),
                    onDismiss: { pendingToggleActiveMemberId = nil }
                )
            }
        }
    }

    private var usersList: some View {
        ZStack(alignment: .bottom) {
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: tokens.spacing.lg) {
                    ReguertaCard {
                        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                            Text(LocalizedStringKey(AccessL10nKey.usersListTitle))
                                .font(tokens.typography.titleCard)
                            ReguertaButton(LocalizedStringKey(AccessL10nKey.usersListActionReload), variant: .text, fullWidth: false) {
                                viewModel.refreshMembers()
                            }
                        }
                    }

                    if sortedMembers.isEmpty {
                        ReguertaCard {
                            Text(LocalizedStringKey(AccessL10nKey.usersListEmpty))
                                .font(tokens.typography.bodySecondary)
                                .foregroundStyle(tokens.colors.textSecondary)
                        }
                    } else {
                        ForEach(sortedMembers) { member in
                            userCardRow(member)
                        }
                    }

                    if canManageMembers {
                        Spacer(minLength: 92.resize)
                    }
                }
            }
            .scrollDismissesKeyboard(.interactively)

            if canManageMembers {
                ReguertaButton(LocalizedStringKey(AccessL10nKey.usersListActionAdd)) {
                    memberDraft = MemberDraft()
                    editingMemberId = nil
                    isEditorOpen = true
                }
                .padding(.bottom, tokens.spacing.sm)
            }
        }
    }

    private func userCardRow(_ member: Member) -> some View {
        ReguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(member.displayName)
                    .font(tokens.typography.titleCard)
                Text(member.normalizedEmail)
                    .font(tokens.typography.bodySecondary)

                if member.roles.contains(.producer) {
                    Text(producerLine(for: member))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.textSecondary)
                }

                if member.roles.contains(.admin) {
                    Text(LocalizedStringKey(AccessL10nKey.usersCardAdminLabel))
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.textSecondary)
                }

                if canManageMembers {
                    HStack(spacing: tokens.spacing.sm) {
                        Spacer()
                        Button {
                            memberDraft = member.toDraft()
                            editingMemberId = member.id
                            isEditorOpen = true
                        } label: {
                            Image(systemName: "pencil")
                                .foregroundStyle(tokens.colors.actionOnPrimary)
                                .padding(tokens.spacing.sm)
                                .background(tokens.colors.actionPrimary)
                                .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))
                        }
                        .buttonStyle(.plain)

                        Button {
                            pendingToggleActiveMemberId = member.id
                        } label: {
                            Image(systemName: "trash")
                                .foregroundStyle(tokens.colors.actionOnPrimary)
                                .padding(tokens.spacing.sm)
                                .background(tokens.colors.feedbackError)
                                .clipShape(RoundedRectangle(cornerRadius: tokens.radius.sm))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var usersEditor: some View {
        ReguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                Text(
                    LocalizedStringKey(
                        editingMember == nil
                            ? AccessL10nKey.usersEditorTitleCreate
                            : AccessL10nKey.usersEditorTitleEdit
                    )
                )
                .font(tokens.typography.titleCard)

                if editingMember == nil {
                    TextField(
                        LocalizedStringKey(AccessL10nKey.emailLabel),
                        text: draftStringBinding(\.email)
                    )
                    .textFieldStyle(.roundedBorder)
                } else if let email = editingMember?.normalizedEmail {
                    Text(email)
                        .font(tokens.typography.body.weight(.semibold))
                        .foregroundStyle(tokens.colors.textPrimary)
                }

                TextField(
                    LocalizedStringKey(AccessL10nKey.displayNameLabel),
                    text: draftStringBinding(\.displayName)
                )
                .textFieldStyle(.roundedBorder)

                TextField(
                    LocalizedStringKey(AccessL10nKey.usersEditorPhoneLabel),
                    text: draftStringBinding(\.phoneNumber)
                )
                .textFieldStyle(.roundedBorder)

                Toggle(
                    LocalizedStringKey(AccessL10nKey.usersEditorCommonPurchaseManagerLabel),
                    isOn: draftBoolBinding(\.isCommonPurchaseManager)
                )

                Toggle(
                    LocalizedStringKey(AccessL10nKey.roleProducer),
                    isOn: Binding(
                        get: { memberDraft.isProducer },
                        set: { value in
                            var updated = memberDraft
                            updated.isProducer = value
                            if !value {
                                updated.companyName = ""
                            }
                            memberDraft = updated
                        }
                    )
                )

                if memberDraft.isProducer {
                    TextField(
                        LocalizedStringKey(AccessL10nKey.usersEditorCompanyNameLabel),
                        text: draftStringBinding(\.companyName)
                    )
                    .textFieldStyle(.roundedBorder)
                }

                Toggle(LocalizedStringKey(AccessL10nKey.roleAdmin), isOn: draftBoolBinding(\.isAdmin))

                ReguertaButton(
                    LocalizedStringKey(
                        editingMember == nil
                            ? AccessL10nKey.usersEditorActionCreate
                            : AccessL10nKey.usersEditorActionUpdate
                    )
                ) {
                    viewModel.saveMemberDraft(editingMemberId: editingMemberId) {
                        editingMemberId = nil
                        isEditorOpen = false
                    }
                }
                ReguertaButton(LocalizedStringKey(AccessL10nKey.commonBack), variant: .text, fullWidth: false) {
                    editingMemberId = nil
                    isEditorOpen = false
                    memberDraft = MemberDraft()
                }
            }
        }
    }

    private func producerLine(for member: Member) -> String {
        let producer = l10n(AccessL10nKey.roleProducer)
        let companyName = member.companyName?.trimmingCharacters(in: .whitespacesAndNewlines)
        let resolvedCompanyName: String
        if let companyName, !companyName.isEmpty {
            resolvedCompanyName = companyName
        } else {
            resolvedCompanyName = l10n(AccessL10nKey.usersCardCompanyNameMissing)
        }
        return "\(producer). \(resolvedCompanyName)"
    }

    private func draftStringBinding(_ keyPath: WritableKeyPath<MemberDraft, String>) -> Binding<String> {
        Binding(
            get: { memberDraft[keyPath: keyPath] },
            set: { value in
                var updated = memberDraft
                updated[keyPath: keyPath] = value
                memberDraft = updated
            }
        )
    }

    private func draftBoolBinding(_ keyPath: WritableKeyPath<MemberDraft, Bool>) -> Binding<Bool> {
        Binding(
            get: { memberDraft[keyPath: keyPath] },
            set: { value in
                var updated = memberDraft
                updated[keyPath: keyPath] = value
                memberDraft = updated
            }
        )
    }
}

private extension Member {
    func toDraft() -> MemberDraft {
        MemberDraft(
            displayName: displayName,
            email: normalizedEmail,
            companyName: companyName ?? "",
            phoneNumber: phoneNumber ?? "",
            isMember: roles.contains(.member),
            isProducer: roles.contains(.producer),
            isAdmin: roles.contains(.admin),
            isCommonPurchaseManager: isCommonPurchaseManager,
            isActive: isActive
        )
    }
}
