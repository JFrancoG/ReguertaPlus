import SwiftUI

struct UsersRouteView: View {
    let tokens: ReguertaDesignTokens
    let viewModel: UsersFeatureViewModel

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
            UsersEditorView(tokens: tokens, viewModel: viewModel)
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

}

private struct UsersEditorView: View {
    let tokens: ReguertaDesignTokens
    @Bindable var viewModel: UsersFeatureViewModel

    var body: some View {
        VStack(spacing: 0) {
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: tokens.spacing.lg) {
                    reguertaInputField(
                        LocalizedStringKey(AccessL10nKey.emailLabel),
                        text: $viewModel.draft.email,
                        isReadOnly: viewModel.editingMember != nil,
                        showsClearAction: viewModel.editingMember == nil,
                        keyboardType: .emailAddress
                    )

                    reguertaInputField(
                        LocalizedStringKey(AccessL10nKey.displayNameLabel),
                        text: $viewModel.draft.displayName,
                        showsClearAction: true,
                        textInputAutocapitalization: .words,
                        autocorrectionDisabled: false
                    )

                    reguertaInputField(
                        LocalizedStringKey(AccessL10nKey.usersEditorPhoneLabel),
                        text: $viewModel.draft.phoneNumber,
                        showsClearAction: true,
                        keyboardType: .phonePad
                    )

                    if viewModel.draft.isProducer {
                        reguertaInputField(
                            LocalizedStringKey(AccessL10nKey.usersEditorCompanyNameLabel),
                            text: $viewModel.draft.companyName,
                            isReadOnly: viewModel.draft.isCommonPurchaseManager,
                            showsClearAction: !viewModel.draft.isCommonPurchaseManager,
                            textInputAutocapitalization: .words,
                            autocorrectionDisabled: false
                        )
                    }

                    if viewModel.draft.isProducer {
                        roleToggle(
                            AccessL10nKey.usersEditorCommonPurchaseManagerLabel,
                            isOn: commonPurchaseManagerBinding
                        )
                    }

                    roleToggle(AccessL10nKey.roleProducer, isOn: producerBinding)

                    roleToggle(AccessL10nKey.roleAdmin, isOn: $viewModel.draft.isAdmin)
                }
            }
            .scrollDismissesKeyboard(.interactively)

            reguertaButton(
                LocalizedStringKey(
                    viewModel.editingMember == nil
                        ? AccessL10nKey.usersEditorActionCreate
                        : AccessL10nKey.usersEditorActionUpdate
                ),
                isEnabled: !viewModel.isSavingMember,
                isLoading: viewModel.isSavingMember
            ) {
                Task { _ = await viewModel.saveDraft() }
            }
            .padding(.top, tokens.spacing.lg)
            .padding(.bottom, tokens.spacing.xxl + tokens.spacing.sm)
        }
    }

    private func roleToggle(_ key: String, isOn: Binding<Bool>) -> some View {
        Toggle(isOn: isOn) {
            Text(LocalizedStringKey(key))
                .font(tokens.typography.body)
                .foregroundStyle(tokens.colors.textPrimary)
        }
    }

    private var producerBinding: Binding<Bool> {
        Binding(
            get: { viewModel.draft.isProducer },
            set: { value in viewModel.setProducer(value) }
        )
    }

    private var commonPurchaseManagerBinding: Binding<Bool> {
        Binding(
            get: { viewModel.draft.isCommonPurchaseManager },
            set: { value in viewModel.setCommonPurchaseManager(value) }
        )
    }
}
