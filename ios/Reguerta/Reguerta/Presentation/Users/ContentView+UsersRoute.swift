import SwiftUI

struct UsersRouteView: View {
    @Environment(\.reguertaMotionPolicy) private var motionPolicy

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
                    .padding(.bottom, tokens.spacing.sm)
                    .animation(
                        motionPolicy.materialAnimation(.easeInOut(duration: tokens.motion.standardDuration)),
                        value: viewModel.sortedMembers.map(\.id)
                    )
                }
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: viewModel.highlightedMemberId) { _, memberId in
                    guard let memberId else { return }
                    withAnimation(
                        motionPolicy.materialAnimation(.easeInOut(duration: tokens.motion.standardDuration))
                    ) {
                        proxy.scrollTo(memberId, anchor: .center)
                    }
                }
            }

        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
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
                Spacer().frame(height: tokens.spacing.lg)
                userCardTextRows(member)

                if viewModel.canManageMembers {
                    Spacer().frame(height: tokens.spacing.lg)
                    userCardActions(member)
                }
                Spacer().frame(height: tokens.spacing.lg)
            }
        }
    }

    @ViewBuilder private func userCardTextRows(_ member: Member) -> some View {
        Text(member.displayName)
            .font(tokens.typography.body.weight(.bold))
            .foregroundStyle(tokens.colors.textPrimary)
            .padding(.horizontal, tokens.spacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)

        Spacer().frame(height: tokens.spacing.lg)

        Text(member.normalizedEmail)
            .font(tokens.typography.body)
            .foregroundStyle(tokens.colors.textPrimary)
            .lineLimit(1)
            .minimumScaleFactor(0.72)
            .padding(.horizontal, tokens.spacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)

        if member.roles.contains(.producer) {
            Spacer().frame(height: tokens.spacing.lg)
            Text(producerLine(for: member))
                .font(tokens.typography.body)
                .foregroundStyle(tokens.colors.textPrimary)
                .lineLimit(2)
                .minimumScaleFactor(0.72)
                .padding(.horizontal, tokens.spacing.lg)
                .frame(maxWidth: .infinity, alignment: .leading)
        }

        if member.roles.contains(.admin) {
            Spacer().frame(height: tokens.spacing.lg)
            Text(LocalizedStringKey(AccessL10nKey.usersCardAdminLabel))
                .font(tokens.typography.body)
                .foregroundStyle(tokens.colors.textPrimary)
                .padding(.horizontal, tokens.spacing.lg)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func userCardActions(_ member: Member) -> some View {
        HStack(spacing: tokens.spacing.sm) {
            Spacer()
            ReguertaListActionIconButton(
                systemImageName: "pencil",
                accessibilityLabel: l10n(AccessL10nKey.usersCardActionEdit),
                backgroundColor: tokens.colors.actionPrimary,
                foregroundColor: tokens.colors.actionOnPrimary,
                action: { viewModel.startEditing(memberId: member.id) }
            )

            ReguertaListActionIconButton(
                systemImageName: "trash",
                accessibilityLabel: l10n(AccessL10nKey.usersCardActionDeactivate),
                backgroundColor: tokens.colors.feedbackError,
                foregroundColor: tokens.colors.feedbackOnError,
                action: { viewModel.requestToggleActive(memberId: member.id) }
            )
            Spacer().frame(width: tokens.spacing.md)
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
                        text: draftBinding(\.email),
                        isReadOnly: viewModel.editingMember != nil,
                        showsClearAction: viewModel.editingMember == nil,
                        keyboardType: .emailAddress
                    )

                    reguertaInputField(
                        LocalizedStringKey(AccessL10nKey.displayNameLabel),
                        text: draftBinding(\.displayName),
                        showsClearAction: true,
                        textInputAutocapitalization: .words,
                        autocorrectionDisabled: false
                    )

                    reguertaInputField(
                        LocalizedStringKey(AccessL10nKey.usersEditorPhoneLabel),
                        text: draftBinding(\.phoneNumber),
                        showsClearAction: true,
                        keyboardType: .phonePad
                    )

                    if viewModel.draft.isProducer {
                        reguertaInputField(
                            LocalizedStringKey(AccessL10nKey.usersEditorCompanyNameLabel),
                            text: draftBinding(\.companyName),
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

                    roleToggle(AccessL10nKey.roleAdmin, isOn: draftBinding(\.isAdmin))
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
        .tint(tokens.colors.controlAccent)
    }

    private func draftBinding<Value>(_ keyPath: WritableKeyPath<MemberDraft, Value>) -> Binding<Value> {
        Binding(
            get: { viewModel.draft[keyPath: keyPath] },
            set: { value in
                var updatedDraft = viewModel.draft
                updatedDraft[keyPath: keyPath] = value
                viewModel.updateDraft(updatedDraft)
            }
        )
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
