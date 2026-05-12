import SwiftUI

struct AdminToolsCardView: View {
    let tokens: ReguertaDesignTokens
    let viewModel: UsersFeatureViewModel
    @Binding var isExpanded: Bool

    var body: some View {
        ReguertaCard {
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
    let isDevelopImpersonationEnabled: Bool
    @Binding var isImpersonationExpanded: Bool
    let nowOverrideMillis: Int64?
    let onClearImpersonation: () -> Void
    let onImpersonate: (String) -> Void
    let onSetNowOverrideMillis: (Int64?) -> Void
    let onShiftNowByDays: (Int) -> Void

    var body: some View {
        ReguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                Text(localizedKey(AccessL10nKey.settingsTitle))
                    .font(tokens.typography.titleSection)
                    .foregroundStyle(tokens.colors.textPrimary)
                Text(localizedKey(AccessL10nKey.settingsSubtitleDevelopImpersonation))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)

                if isDevelopImpersonationEnabled, let session {
                    impersonationSection(session: session)
                    Divider()
                        .overlay(tokens.colors.borderSubtle)
                    developmentTimeSection
                }

                if let session, session.member.isAdmin {
                    Divider()
                        .overlay(tokens.colors.borderSubtle)
                    adminDeliveryCalendarSection
                    Divider()
                        .overlay(tokens.colors.borderSubtle)
                    adminShiftPlanningSection
                }
            }
        }
    }

    private var developmentTimeSection: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            Text("Reloj de pruebas (develop)")
                .font(tokens.typography.titleCard)
                .foregroundStyle(tokens.colors.textPrimary)
            Text(
                nowOverrideMillis.map { "Fecha simulada: \(localizedDateTime($0))" }
                    ?? "Fecha simulada: desactivada (usando fecha real)"
            )
            .font(tokens.typography.bodySecondary)
            .foregroundStyle(tokens.colors.textSecondary)

            HStack(spacing: tokens.spacing.sm) {
                ReguertaButton("-1 día", variant: .text) {
                    onShiftNowByDays(-1)
                }
                ReguertaButton("+1 día", variant: .text) {
                    onShiftNowByDays(1)
                }
            }

            HStack(spacing: tokens.spacing.sm) {
                ReguertaButton("Ahora", variant: .text) {
                    onSetNowOverrideMillis(Int64(Date().timeIntervalSince1970 * 1_000))
                }
                ReguertaButton("Reset", variant: .text) {
                    onSetNowOverrideMillis(nil)
                }
            }
        }
    }

    private func localizedDateTime(_ millis: Int64) -> String {
        let formatter = DateFormatter()
        formatter.locale = .current
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: Date(timeIntervalSince1970: TimeInterval(millis) / 1_000))
    }

    @ViewBuilder
    private func impersonationSection(session: AuthorizedSession) -> some View {
        let isImpersonating = session.member.id != session.authenticatedMember.id

        Text(l10n(AccessL10nKey.settingsImpersonationAccountReal, session.authenticatedMember.displayName))
            .font(tokens.typography.body.weight(.semibold))
            .foregroundStyle(tokens.colors.textPrimary)
        Text(
            isImpersonating
                ? l10n(AccessL10nKey.settingsImpersonationViewingAs, session.member.displayName)
                : l10n(AccessL10nKey.settingsImpersonationUsingOwnProfile)
        )
        .font(tokens.typography.bodySecondary)
        .foregroundStyle(tokens.colors.textSecondary)

        if isImpersonating {
            ReguertaButton(localizedKey(AccessL10nKey.settingsImpersonationActionBackToRealProfile), action: onClearImpersonation)
        }

        Divider()
            .overlay(tokens.colors.borderSubtle)

        Text(localizedKey(AccessL10nKey.settingsImpersonationSectionTitle))
            .font(tokens.typography.titleCard)
            .foregroundStyle(tokens.colors.textPrimary)
        ReguertaButton(
            localizedKey(
                isImpersonationExpanded
                    ? AccessL10nKey.settingsImpersonationActionHideMembers
                    : AccessL10nKey.settingsImpersonationActionSelectMember
            ),
            variant: .text
        ) {
            isImpersonationExpanded.toggle()
        }

        if isImpersonationExpanded {
            ForEach(activeMembersSortedByName(in: session), id: \.id) { member in
                ReguertaButton(LocalizedStringKey(member.displayName), variant: .text) {
                    onImpersonate(member.id)
                    isImpersonationExpanded = false
                }
                .disabled(member.id == session.member.id)
            }
        }
    }

    @ViewBuilder
    private var adminDeliveryCalendarSection: some View {
        adminDeliveryCalendarContent
        .sheet(isPresented: deliveryCalendarWeekPickerPresentedBinding) {
            DeliveryCalendarWeekPickerSheet(
                futureWeeks: shiftsViewModel.futureDeliveryWeeks,
                overrides: shiftsViewModel.deliveryCalendarOverrides,
                selectedWeekKey: deliveryCalendarSelectedWeekBinding,
                onSelectWeek: { weekKey in
                    shiftsViewModel.selectCalendarWeek(weekKey)
                }
            )
            .presentationDetents([.medium, .large])
        }
        .sheet(
            isPresented: deliveryCalendarEditorPresentedBinding,
            onDismiss: shiftsViewModel.dismissCalendarEditor,
            content: { deliveryCalendarEditorSheet }
        )
    }

    private var adminDeliveryCalendarContent: some View {
        let defaultDayLabel = shiftsViewModel.defaultDeliveryDayOfWeek.map { l10n($0.titleKey) } ??
            l10n(AccessL10nKey.settingsDeliveryCalendarDefaultDayUnset)

        return VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            Text(localizedKey(AccessL10nKey.settingsDeliveryCalendarTitle))
                .font(tokens.typography.titleCard)
                .foregroundStyle(tokens.colors.textPrimary)
            Text(l10n(AccessL10nKey.settingsDeliveryCalendarDefaultDay, defaultDayLabel))
                .font(tokens.typography.body.weight(.semibold))
                .foregroundStyle(tokens.colors.textPrimary)

            if shiftsViewModel.isLoadingDeliveryCalendar {
                Text(localizedKey(AccessL10nKey.settingsDeliveryCalendarLoading))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
            } else if shiftsViewModel.futureDeliveryWeeks.isEmpty {
                Text(localizedKey(AccessL10nKey.settingsDeliveryCalendarEmpty))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
            } else {
                HStack(spacing: tokens.spacing.sm) {
                    ReguertaButton(localizedKey(AccessL10nKey.settingsDeliveryCalendarActionChangeDay), fullWidth: false) {
                        shiftsViewModel.openCalendarWeekPicker()
                    }
                    ReguertaButton(localizedKey(AccessL10nKey.commonActionReload), variant: .text, fullWidth: false) {
                        Task { await shiftsViewModel.refreshDeliveryCalendar() }
                    }
                }
                Text(localizedKey(AccessL10nKey.settingsDeliveryCalendarHelp))
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
            }
        }
    }

    @ViewBuilder
    private var deliveryCalendarEditorSheet: some View {
        if let shift = shiftsViewModel.selectedDeliveryCalendarShift {
            DeliveryCalendarEditorSheet(
                shift: shift,
                overrideEntry: shiftsViewModel.selectedDeliveryCalendarOverride,
                selectedWeekday: deliveryCalendarWeekdayBinding,
                isSaving: shiftsViewModel.isSavingDeliveryCalendar,
                onRefresh: {
                    Task { await shiftsViewModel.refreshDeliveryCalendar() }
                },
                onSave: {
                    Task { await shiftsViewModel.saveDeliveryCalendarOverride() }
                },
                onDelete: {
                    Task { await shiftsViewModel.deleteDeliveryCalendarOverride() }
                }
            )
            .presentationDetents([.medium, .large])
        }
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
                ReguertaButton(localizedKey(AccessL10nKey.settingsShiftPlanningActionGenerateDelivery), fullWidth: false) {
                    shiftsViewModel.requestShiftPlanning(.delivery)
                }
                ReguertaButton(localizedKey(AccessL10nKey.settingsShiftPlanningActionGenerateMarket), fullWidth: false) {
                    shiftsViewModel.requestShiftPlanning(.market)
                }
            }
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

    private func activeMembersSortedByName(in session: AuthorizedSession) -> [Member] {
        session.members
            .filter(\.isActive)
            .sorted { lhs, rhs in
                lhs.displayName.localizedCaseInsensitiveCompare(rhs.displayName) == .orderedAscending
            }
    }

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }

    private var deliveryCalendarWeekPickerPresentedBinding: Binding<Bool> {
        Binding(
            get: { shiftsViewModel.isDeliveryCalendarWeekPickerPresented },
            set: { shiftsViewModel.isDeliveryCalendarWeekPickerPresented = $0 }
        )
    }

    private var deliveryCalendarEditorPresentedBinding: Binding<Bool> {
        Binding(
            get: { shiftsViewModel.isDeliveryCalendarEditorPresented },
            set: { shiftsViewModel.isDeliveryCalendarEditorPresented = $0 }
        )
    }

    private var deliveryCalendarSelectedWeekBinding: Binding<String> {
        Binding(
            get: { shiftsViewModel.selectedDeliveryCalendarWeekKey ?? shiftsViewModel.futureDeliveryWeeks.first?.weekKey ?? "" },
            set: { shiftsViewModel.selectedDeliveryCalendarWeekKey = $0 }
        )
    }

    private var deliveryCalendarWeekdayBinding: Binding<DeliveryWeekday> {
        Binding(
            get: { shiftsViewModel.selectedDeliveryCalendarWeekday },
            set: { shiftsViewModel.selectedDeliveryCalendarWeekday = $0 }
        )
    }
}
