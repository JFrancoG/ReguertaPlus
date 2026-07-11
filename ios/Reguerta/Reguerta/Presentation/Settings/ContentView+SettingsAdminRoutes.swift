import SwiftUI

struct AdminToolsCardView: View {
    let tokens: ReguertaDesignTokens
    let viewModel: UsersFeatureViewModel
    @Binding var isExpanded: Bool

    var body: some View {
        reguertaCard {
            DisclosureGroup(isExpanded: $isExpanded) {
                VStack(alignment: .leading, spacing: tokens.spacing.md) {
                    ForEach(viewModel.sortedMembers) { member in
                        AdminMemberRowView(
                            tokens: tokens,
                            member: member,
                            onToggleAdmin: { memberId in
                                Task { _ = await viewModel.toggleAdmin(memberId: memberId) }
                            },
                            onToggleActive: { memberId in
                                Task { _ = await viewModel.toggleActive(memberId: memberId) }
                            }
                        )
                    }

                    Divider()

                    Text(localizedKey(AccessL10nKey.adminCreatePreAuthorizedTitle))
                        .font(tokens.typography.titleCard)
                    TextField(localizedKey(AccessL10nKey.displayNameLabel), text: draftStringBinding(\.displayName))
                        .textFieldStyle(.roundedBorder)
                    TextField(localizedKey(AccessL10nKey.emailLabel), text: draftStringBinding(\.email))
                        .textInputAutocapitalization(.never)
                        .textFieldStyle(.roundedBorder)

                    Toggle(localizedKey(AccessL10nKey.roleMember), isOn: draftBoolBinding(\.isMember))
                    Toggle(localizedKey(AccessL10nKey.roleProducer), isOn: draftBoolBinding(\.isProducer))
                    Toggle(localizedKey(AccessL10nKey.roleAdmin), isOn: draftBoolBinding(\.isAdmin))
                    Toggle(localizedKey(AccessL10nKey.roleActive), isOn: draftBoolBinding(\.isActive))

                    Button {
                        Task { _ = await viewModel.createAuthorizedMember() }
                    } label: {
                        Text(localizedKey(AccessL10nKey.createMember))
                    }
                    .disabled(viewModel.isSavingMember)
                }
                .padding(.top, tokens.spacing.sm)
            } label: {
                VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                    Text(localizedKey(AccessL10nKey.adminManageMembersTitle))
                        .font(tokens.typography.titleCard)
                    Text(localizedKey(AccessL10nKey.adminManageMembersSubtitle))
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)
                }
            }
        }
    }

    private func draftStringBinding(_ keyPath: WritableKeyPath<MemberDraft, String>) -> Binding<String> {
        Binding(
            get: { viewModel.draft[keyPath: keyPath] },
            set: {
                var updated = viewModel.draft
                updated[keyPath: keyPath] = $0
                viewModel.updateDraft(updated)
            }
        )
    }

    private func draftBoolBinding(_ keyPath: WritableKeyPath<MemberDraft, Bool>) -> Binding<Bool> {
        Binding(
            get: { viewModel.draft[keyPath: keyPath] },
            set: {
                var updated = viewModel.draft
                updated[keyPath: keyPath] = $0
                viewModel.updateDraft(updated)
            }
        )
    }

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }
}

private struct AdminMemberRowView: View {
    let tokens: ReguertaDesignTokens
    let member: Member
    let onToggleAdmin: (String) -> Void
    let onToggleActive: (String) -> Void

    private var localizedRoles: String {
        member.roles
            .sorted { lhs, rhs in lhs.rawValue < rhs.rawValue }
            .map(localizedRoleValue(_:))
            .joined(separator: ", ")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.xs + 2) {
            Text(member.displayName)
                .font(tokens.typography.bodySecondary.weight(.semibold))
            Text(member.normalizedEmail)
                .font(tokens.typography.bodySecondary)
            Text(localizedFormat(AccessL10nKey.roles, localizedRoles))
                .font(tokens.typography.label)
            Text(
                localizedFormat(
                    AccessL10nKey.authLinked,
                    Reguerta.l10n(member.authUid == nil ? AccessL10nKey.no : AccessL10nKey.yes)
                )
            )
                .font(tokens.typography.label)
            Text(
                localizedFormat(
                    AccessL10nKey.status,
                    Reguerta.l10n(member.isActive ? AccessL10nKey.statusActive : AccessL10nKey.statusInactive)
                )
            )
            .font(tokens.typography.label)

            HStack {
                Button {
                    onToggleAdmin(member.id)
                } label: {
                    Text(localizedKey(member.isAdmin ? AccessL10nKey.revokeAdmin : AccessL10nKey.grantAdmin))
                }
                Button {
                    onToggleActive(member.id)
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

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }

    private func localizedFormat(_ key: String, _ argument: String) -> LocalizedStringKey {
        LocalizedStringKey("\(key) \(argument)")
    }
}

struct SettingsRouteView: View {
    let tokens: ReguertaDesignTokens
    let session: AuthorizedSession?
    let shiftsViewModel: ShiftsFeatureViewModel
    let productsViewModel: ProductsRouteViewModel
    let isDevelopImpersonationEnabled: Bool
    @Binding var isImpersonationExpanded: Bool
    @AppStorage(AppAppearance.storageKey) private var appAppearanceRawValue = AppAppearance.system.rawValue
    let nowOverrideMillis: Int64?
    let onClearImpersonation: () -> Void
    let onImpersonate: (String) -> Void
    let onSetNowOverrideMillis: (Int64?) -> Void
    let onShiftNowByDays: (Int) -> Void

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                SettingsScopeHeaderView(
                    tokens: tokens,
                    titleKey: AccessL10nKey.settingsScopeGeneral
                )
                SettingsAppearanceSectionView(
                    tokens: tokens,
                    appearanceRawValue: $appAppearanceRawValue
                )

                if let session, session.member.isProducer {
                    Divider()
                        .overlay(tokens.colors.borderSubtle)
                    SettingsScopeHeaderView(
                        tokens: tokens,
                        titleKey: AccessL10nKey.settingsScopeProducer
                    )
                    SettingsVacationModeSectionView(
                        tokens: tokens,
                        isEnabled: !session.member.producerCatalogEnabled,
                        isSaving: productsViewModel.isUpdatingCatalogVisibility,
                        onChanged: { enabled in
                            Task { await productsViewModel.setVacationModeEnabled(enabled) }
                        }
                    )
                }

                if let session, session.member.isAdmin {
                    Divider()
                        .overlay(tokens.colors.borderSubtle)
                    SettingsScopeHeaderView(
                        tokens: tokens,
                        titleKey: AccessL10nKey.settingsScopeAdmin
                    )
                    adminDeliveryCalendarSection
                    Divider()
                        .overlay(tokens.colors.borderSubtle)
                    adminShiftPlanningSection
                }

                if isDevelopImpersonationEnabled, let session {
                    Divider()
                        .overlay(tokens.colors.borderSubtle)
                    SettingsDevelopSectionView(
                        tokens: tokens,
                        session: session,
                        isImpersonationExpanded: $isImpersonationExpanded,
                        nowOverrideMillis: nowOverrideMillis,
                        onClearImpersonation: onClearImpersonation,
                        onImpersonate: onImpersonate,
                        onSetNowOverrideMillis: onSetNowOverrideMillis,
                        onShiftNowByDays: onShiftNowByDays
                    )
                }
            }
            .padding(.bottom, tokens.spacing.sm)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    @ViewBuilder
    private var adminDeliveryCalendarSection: some View {
        SettingsDeliveryCalendarSectionView(
            tokens: tokens,
            shiftsViewModel: shiftsViewModel
        )
    }

    private var adminShiftPlanningSection: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            Text(localizedKey(AccessL10nKey.settingsShiftPlanningTitle))
                .font(tokens.typography.titleCard)
                .foregroundStyle(tokens.colors.textPrimary)
            Text(localizedKey(AccessL10nKey.settingsShiftPlanningSubtitle))
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.textSecondary)
            HStack(spacing: tokens.spacing.sm) {
                reguertaButton(localizedKey(AccessL10nKey.settingsShiftPlanningActionGenerateDelivery)) {
                    shiftsViewModel.requestShiftPlanning(.delivery)
                }
                .frame(maxWidth: .infinity)
                reguertaButton(localizedKey(AccessL10nKey.settingsShiftPlanningActionGenerateMarket)) {
                    shiftsViewModel.requestShiftPlanning(.market)
                }
                .frame(maxWidth: .infinity)
            }
            .frame(maxWidth: .infinity, alignment: .center)
            .disabled(shiftsViewModel.isSubmittingShiftPlanningRequest)
            if shiftsViewModel.isSubmittingShiftPlanningRequest {
                Text(localizedKey(AccessL10nKey.settingsShiftPlanningSubmitting))
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
            }
        }
        .alert(
            shiftsViewModel.pendingShiftPlanningType == nil
                ? localizedKey("")
                : localizedKey(
                    shiftsViewModel.pendingShiftPlanningType == .delivery
                        ? AccessL10nKey.settingsShiftPlanningAlertTitleDelivery
                        : AccessL10nKey.settingsShiftPlanningAlertTitleMarket
                ),
            isPresented: Binding(
                get: { shiftsViewModel.pendingShiftPlanningType != nil },
                set: { presented in
                    if !presented {
                        shiftsViewModel.dismissShiftPlanningRequest()
                    }
                }
            ),
            presenting: shiftsViewModel.pendingShiftPlanningType
        ) { type in
            Button(localizedKey(AccessL10nKey.commonActionCancel), role: .cancel) {
                shiftsViewModel.dismissShiftPlanningRequest()
            }
            Button(localizedKey(AccessL10nKey.commonActionConfirm)) {
                shiftsViewModel.requestShiftPlanning(type)
                Task { await shiftsViewModel.confirmShiftPlanningRequest() }
            }
        } message: { _ in
            Text(localizedKey(AccessL10nKey.settingsShiftPlanningAlertMessage))
        }
    }

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }

}
