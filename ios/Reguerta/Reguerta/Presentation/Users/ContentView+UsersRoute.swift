import SwiftUI

struct UsersRouteView: View {
    let tokens: ReguertaDesignTokens
    let viewModel: UsersFeatureViewModel

    private var editingMember: Member? {
        viewModel.editingMember
    }

    var body: some View {
        routeContent
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .overlay {
                if let member = viewModel.pendingToggleMember {
                    reguertaDialog(
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
                                Task { _ = await viewModel.confirmToggleActive() }
                            }
                        ),
                        secondaryAction: ReguertaDialogAction(
                            title: AccessL10nKey.commonActionCancel,
                            action: viewModel.dismissToggleActive
                        ),
                        onDismiss: viewModel.dismissToggleActive
                    )
                }
            }
    }

    @ViewBuilder
    private var routeContent: some View {
        if viewModel.isEditorOpen && viewModel.canManageMembers {
            usersEditor
        } else {
            usersList
        }
    }

    private var usersList: some View {
        ZStack(alignment: .bottom) {
            ScrollViewReader { proxy in
                ScrollView(.vertical, showsIndicators: false) {
                    VStack(alignment: .leading, spacing: tokens.spacing.lg) {
                        if viewModel.sortedMembers.isEmpty {
                            reguertaCard {
                                Text(LocalizedStringKey(AccessL10nKey.usersListEmpty))
                                    .font(tokens.typography.bodySecondary)
                                    .foregroundStyle(tokens.colors.textSecondary)
                            }
                        } else {
                            ForEach(viewModel.sortedMembers) { member in
                                userCardRow(member)
                                    .id(member.id)
                            }
                        }
                    }
                    .padding(.bottom, viewModel.canManageMembers ? ReguertaFloatingActionButtonLayout.scrollContentBottomPadding : tokens.spacing.sm)
                    .animation(.easeInOut(duration: 0.25), value: viewModel.sortedMembers.map(\.id))
                }
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: viewModel.highlightedMemberId) { _, memberId in
                    guard let memberId else { return }
                    withAnimation(.easeInOut(duration: 0.25)) {
                        proxy.scrollTo(memberId, anchor: .center)
                    }
                }
            }

            if viewModel.canManageMembers {
                reguertaFloatingActionButton(
                    LocalizedStringKey(AccessL10nKey.usersListActionAdd),
                    accessibilityIdentifier: "users.addButton"
                ) {
                    viewModel.startCreating()
                }
            }
        }
    }

    private func userCardRow(_ member: Member) -> some View {
        reguertaListItemCard(isHighlighted: viewModel.highlightedMemberId == member.id) {
            VStack(alignment: .leading, spacing: 0) {
                Spacer().frame(height: 16.resize)
                userCardTextRows(member)

                if viewModel.canManageMembers {
                    Spacer().frame(height: 16.resize)
                    userCardActions(member)
                }
                Spacer().frame(height: 16.resize)
            }
        }
    }

    @ViewBuilder
    private func userCardTextRows(_ member: Member) -> some View {
        Text(member.displayName)
            .font(.custom("CabinSketch-Bold", size: 18.resize, relativeTo: .body))
            .foregroundStyle(tokens.colors.textPrimary)
            .padding(.horizontal, 16.resize)
            .frame(maxWidth: .infinity, alignment: .leading)

        Spacer().frame(height: 16.resize)

        Text(member.normalizedEmail)
            .font(.custom("CabinSketch-Regular", size: 18.resize, relativeTo: .body))
            .foregroundStyle(tokens.colors.textPrimary)
            .lineLimit(1)
            .minimumScaleFactor(0.72)
            .padding(.horizontal, 16.resize)
            .frame(maxWidth: .infinity, alignment: .leading)

        if member.roles.contains(.producer) {
            Spacer().frame(height: 16.resize)
            Text(producerLine(for: member))
                .font(.custom("CabinSketch-Regular", size: 18.resize, relativeTo: .body))
                .foregroundStyle(tokens.colors.textPrimary)
                .lineLimit(2)
                .minimumScaleFactor(0.72)
                .padding(.horizontal, 16.resize)
                .frame(maxWidth: .infinity, alignment: .leading)
        }

        if member.roles.contains(.admin) {
            Spacer().frame(height: 16.resize)
            Text(LocalizedStringKey(AccessL10nKey.usersCardAdminLabel))
                .font(.custom("CabinSketch-Regular", size: 18.resize, relativeTo: .body))
                .foregroundStyle(tokens.colors.textPrimary)
                .padding(.horizontal, 16.resize)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func userCardActions(_ member: Member) -> some View {
        HStack(spacing: tokens.spacing.sm) {
            Spacer()
            ReguertaListActionIconButton(
                systemImageName: "pencil",
                accessibilityLabel: "Editar Regüertense",
                backgroundColor: tokens.colors.actionPrimary,
                action: { viewModel.startEditing(memberId: member.id) }
            )

            ReguertaListActionIconButton(
                systemImageName: "trash",
                accessibilityLabel: "Desactivar Regüertense",
                backgroundColor: tokens.colors.feedbackError,
                action: { viewModel.requestToggleActive(memberId: member.id) }
            )
            Spacer().frame(width: 12.resize)
        }
    }

    private var usersEditor: some View {
        ScrollView(.vertical, showsIndicators: false) {
            reguertaCard {
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
                        isOn: producerBinding
                    )

                    if viewModel.draft.isProducer {
                        TextField(
                            LocalizedStringKey(AccessL10nKey.usersEditorCompanyNameLabel),
                            text: draftStringBinding(\.companyName)
                        )
                        .textFieldStyle(.roundedBorder)
                    }

                    Toggle(LocalizedStringKey(AccessL10nKey.roleAdmin), isOn: draftBoolBinding(\.isAdmin))

                    reguertaButton(
                        LocalizedStringKey(
                            editingMember == nil
                                ? AccessL10nKey.usersEditorActionCreate
                                : AccessL10nKey.usersEditorActionUpdate
                        ),
                        isEnabled: !viewModel.isSavingMember,
                        isLoading: viewModel.isSavingMember
                    ) {
                        Task { _ = await viewModel.saveDraft() }
                    }
                    reguertaButton(LocalizedStringKey(AccessL10nKey.commonBack), variant: .text, fullWidth: false) {
                        viewModel.clearEditor()
                    }
                }
            }
            .padding(.bottom, tokens.spacing.sm)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private var producerBinding: Binding<Bool> {
        Binding(
            get: { viewModel.draft.isProducer },
            set: { value in
                var updated = viewModel.draft
                updated.isProducer = value
                if !value {
                    updated.companyName = ""
                }
                viewModel.updateDraft(updated)
            }
        )
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
            get: { viewModel.draft[keyPath: keyPath] },
            set: { value in
                var updated = viewModel.draft
                updated[keyPath: keyPath] = value
                viewModel.updateDraft(updated)
            }
        )
    }

    private func draftBoolBinding(_ keyPath: WritableKeyPath<MemberDraft, Bool>) -> Binding<Bool> {
        Binding(
            get: { viewModel.draft[keyPath: keyPath] },
            set: { value in
                var updated = viewModel.draft
                updated[keyPath: keyPath] = value
                viewModel.updateDraft(updated)
            }
        )
    }
}
