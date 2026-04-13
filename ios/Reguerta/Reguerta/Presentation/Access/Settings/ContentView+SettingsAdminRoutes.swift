import SwiftUI

struct AdminToolsCardView: View {
    let tokens: ReguertaDesignTokens
    let session: AuthorizedSession
    @Binding var isExpanded: Bool
    @Binding var memberDraft: MemberDraft
    let onCreateMember: () -> Void
    let onToggleAdmin: (String) -> Void
    let onToggleActive: (String) -> Void

    var body: some View {
        ReguertaCard {
            DisclosureGroup(isExpanded: $isExpanded) {
                VStack(alignment: .leading, spacing: tokens.spacing.md) {
                    ForEach(session.members) { member in
                        AdminMemberRowView(
                            tokens: tokens,
                            member: member,
                            onToggleAdmin: onToggleAdmin,
                            onToggleActive: onToggleActive
                        )
                    }

                    Divider()

                    Text(localizedKey(AccessL10nKey.adminCreatePreAuthorizedTitle))
                        .font(tokens.typography.titleCard)
                    TextField(localizedKey(AccessL10nKey.displayNameLabel), text: memberDraftBinding(\.displayName))
                        .textFieldStyle(.roundedBorder)
                    TextField(localizedKey(AccessL10nKey.emailLabel), text: memberDraftBinding(\.email))
                        .textInputAutocapitalization(.never)
                        .textFieldStyle(.roundedBorder)

                    Toggle(localizedKey(AccessL10nKey.roleMember), isOn: memberDraftBinding(\.isMember))
                    Toggle(localizedKey(AccessL10nKey.roleProducer), isOn: memberDraftBinding(\.isProducer))
                    Toggle(localizedKey(AccessL10nKey.roleAdmin), isOn: memberDraftBinding(\.isAdmin))
                    Toggle(localizedKey(AccessL10nKey.roleActive), isOn: memberDraftBinding(\.isActive))

                    Button(action: onCreateMember) {
                        Text(localizedKey(AccessL10nKey.createMember))
                    }
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

    private func memberDraftBinding(_ keyPath: WritableKeyPath<MemberDraft, String>) -> Binding<String> {
        Binding(
            get: { memberDraft[keyPath: keyPath] },
            set: {
                var updated = memberDraft
                updated[keyPath: keyPath] = $0
                memberDraft = updated
            }
        )
    }

    private func memberDraftBinding(_ keyPath: WritableKeyPath<MemberDraft, Bool>) -> Binding<Bool> {
        Binding(
            get: { memberDraft[keyPath: keyPath] },
            set: {
                var updated = memberDraft
                updated[keyPath: keyPath] = $0
                memberDraft = updated
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
    let isDevelopImpersonationEnabled: Bool
    @Binding var isImpersonationExpanded: Bool
    let isLoadingDeliveryCalendar: Bool
    let defaultDeliveryDayOfWeek: DeliveryWeekday?
    let shiftsFeed: [ShiftAssignment]
    let deliveryCalendarOverrides: [DeliveryCalendarOverride]
    @Binding var isDeliveryCalendarEditorPresented: Bool
    @Binding var isDeliveryCalendarWeekPickerPresented: Bool
    @Binding var selectedDeliveryCalendarWeekKey: String?
    let isSavingDeliveryCalendar: Bool
    let isSubmittingShiftPlanningRequest: Bool
    @Binding var pendingShiftPlanningType: ShiftPlanningRequestType?
    let nowOverrideMillis: Int64?
    let onClearImpersonation: () -> Void
    let onImpersonate: (String) -> Void
    let onSetNowOverrideMillis: (Int64?) -> Void
    let onShiftNowByDays: (Int) -> Void
    let onRefreshDeliveryCalendar: () -> Void
    let onSaveDeliveryCalendarOverride: (String, DeliveryWeekday, String) -> Void
    let onDeleteDeliveryCalendarOverride: (String) -> Void
    let onSubmitShiftPlanningRequest: (ShiftPlanningRequestType, @escaping @MainActor @Sendable () -> Void) -> Void

    private var futureDeliveryWeeks: [ShiftAssignment] {
        let nowMillis = nowOverrideMillis ?? Int64(Date().timeIntervalSince1970 * 1_000)
        let sortedWeeks = shiftsFeed
            .filter { $0.type == .delivery && effectiveDateMillis(for: $0) > nowMillis }
            .sorted { effectiveDateMillis(for: $0) < effectiveDateMillis(for: $1) }

        var seenWeekKeys = Set<String>()
        return sortedWeeks.filter { seenWeekKeys.insert($0.weekKey).inserted }
    }

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
                    adminDeliveryCalendarSection(session: session)
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
    private func adminDeliveryCalendarSection(session: AuthorizedSession) -> some View {
        adminDeliveryCalendarContent
        .sheet(isPresented: $isDeliveryCalendarWeekPickerPresented) {
            DeliveryCalendarWeekPickerSheet(
                futureWeeks: futureDeliveryWeeks,
                overrides: deliveryCalendarOverrides,
                onSelectWeek: { weekKey in
                    selectedDeliveryCalendarWeekKey = weekKey
                    isDeliveryCalendarWeekPickerPresented = false
                    isDeliveryCalendarEditorPresented = true
                }
            )
            .presentationDetents([.medium, .large])
        }
        .sheet(
            isPresented: $isDeliveryCalendarEditorPresented,
            onDismiss: { selectedDeliveryCalendarWeekKey = nil },
            content: { deliveryCalendarEditorSheet(session: session) }
        )
    }

    private var adminDeliveryCalendarContent: some View {
        let defaultDayLabel = defaultDeliveryDayOfWeek.map { l10n($0.titleKey) } ?? l10n(AccessL10nKey.settingsDeliveryCalendarDefaultDayUnset)

        return VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            Text(localizedKey(AccessL10nKey.settingsDeliveryCalendarTitle))
                .font(tokens.typography.titleCard)
                .foregroundStyle(tokens.colors.textPrimary)
            Text(l10n(AccessL10nKey.settingsDeliveryCalendarDefaultDay, defaultDayLabel))
                .font(tokens.typography.body.weight(.semibold))
                .foregroundStyle(tokens.colors.textPrimary)

            if isLoadingDeliveryCalendar {
                Text(localizedKey(AccessL10nKey.settingsDeliveryCalendarLoading))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
            } else if futureDeliveryWeeks.isEmpty {
                Text(localizedKey(AccessL10nKey.settingsDeliveryCalendarEmpty))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
            } else {
                HStack(spacing: tokens.spacing.sm) {
                    ReguertaButton(localizedKey(AccessL10nKey.settingsDeliveryCalendarActionChangeDay), fullWidth: false) {
                        isDeliveryCalendarWeekPickerPresented = true
                    }
                    ReguertaButton(localizedKey(AccessL10nKey.commonActionReload), variant: .text, fullWidth: false, action: onRefreshDeliveryCalendar)
                }
                Text(localizedKey(AccessL10nKey.settingsDeliveryCalendarHelp))
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
            }
        }
    }

    @ViewBuilder
    private func deliveryCalendarEditorSheet(session: AuthorizedSession) -> some View {
        if let weekKey = selectedDeliveryCalendarWeekKey,
           let shift = futureDeliveryWeeks.first(where: { $0.weekKey == weekKey }) {
            DeliveryCalendarEditorSheet(
                shift: shift,
                overrideEntry: deliveryCalendarOverrides.first(where: { $0.weekKey == weekKey }),
                defaultDay: defaultDeliveryDayOfWeek ?? .wednesday,
                isSaving: isSavingDeliveryCalendar,
                onRefresh: onRefreshDeliveryCalendar,
                onSave: { selectedWeekKey, weekday in
                    onSaveDeliveryCalendarOverride(selectedWeekKey, weekday, session.member.id)
                },
                onDelete: onDeleteDeliveryCalendarOverride
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
                    pendingShiftPlanningType = .delivery
                }
                ReguertaButton(localizedKey(AccessL10nKey.settingsShiftPlanningActionGenerateMarket), fullWidth: false) {
                    pendingShiftPlanningType = .market
                }
            }
            .disabled(isSubmittingShiftPlanningRequest)
            if isSubmittingShiftPlanningRequest {
                Text(localizedKey(AccessL10nKey.settingsShiftPlanningSubmitting))
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
            }
        }
        .alert(
            pendingShiftPlanningType == nil
                ? localizedKey("")
                : localizedKey(
                    pendingShiftPlanningType == .delivery
                        ? AccessL10nKey.settingsShiftPlanningAlertTitleDelivery
                        : AccessL10nKey.settingsShiftPlanningAlertTitleMarket
                ),
            isPresented: Binding(
                get: { pendingShiftPlanningType != nil },
                set: { presented in
                    if !presented {
                        pendingShiftPlanningType = nil
                    }
                }
            ),
            presenting: pendingShiftPlanningType
        ) { type in
            Button(localizedKey(AccessL10nKey.commonActionCancel), role: .cancel) {
                pendingShiftPlanningType = nil
            }
            Button(localizedKey(AccessL10nKey.commonActionConfirm)) {
                onSubmitShiftPlanningRequest(type) {
                    pendingShiftPlanningType = nil
                }
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

    private func effectiveDateMillis(for shift: ShiftAssignment) -> Int64 {
        deliveryCalendarOverrides.first(where: { $0.weekKey == shift.weekKey })?.deliveryDateMillis ?? shift.dateMillis
    }

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }
}
