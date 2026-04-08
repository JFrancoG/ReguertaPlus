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
    let onClearImpersonation: () -> Void
    let onImpersonate: (String) -> Void
    let onRefreshDeliveryCalendar: () -> Void
    let onSaveDeliveryCalendarOverride: (String, DeliveryWeekday, String) -> Void
    let onDeleteDeliveryCalendarOverride: (String) -> Void
    let onSubmitShiftPlanningRequest: (ShiftPlanningRequestType, @escaping @MainActor @Sendable () -> Void) -> Void

    private var futureDeliveryWeeks: [ShiftAssignment] {
        let nowMillis = Int64(Date().timeIntervalSince1970 * 1_000)
        let sortedWeeks = shiftsFeed
            .filter { $0.type == .delivery && effectiveDateMillis(for: $0) > nowMillis }
            .sorted { effectiveDateMillis(for: $0) < effectiveDateMillis(for: $1) }

        var seenWeekKeys = Set<String>()
        return sortedWeeks.filter { seenWeekKeys.insert($0.weekKey).inserted }
    }

    var body: some View {
        ReguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.md) {
                Text("Ajustes")
                    .font(tokens.typography.titleSection)
                    .foregroundStyle(tokens.colors.textPrimary)
                Text("La impersonacion solo aparece en develop para probar flujos con otros socios sin salir de tu sesion real.")
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)

                if isDevelopImpersonationEnabled, let session {
                    impersonationSection(session: session)
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

    @ViewBuilder
    private func impersonationSection(session: AuthorizedSession) -> some View {
        let isImpersonating = session.member.id != session.authenticatedMember.id

        Text("Cuenta real: \(session.authenticatedMember.displayName)")
            .font(tokens.typography.body.weight(.semibold))
            .foregroundStyle(tokens.colors.textPrimary)
        Text(
            isImpersonating
                ? "Viendo la app como: \(session.member.displayName)"
                : "Ahora mismo estas usando tu propio perfil."
        )
        .font(tokens.typography.bodySecondary)
        .foregroundStyle(tokens.colors.textSecondary)

        if isImpersonating {
            ReguertaButton("Volver a mi perfil real", action: onClearImpersonation)
        }

        Divider()
            .overlay(tokens.colors.borderSubtle)

        Text("Impersonacion develop")
            .font(tokens.typography.titleCard)
            .foregroundStyle(tokens.colors.textPrimary)
        ReguertaButton(isImpersonationExpanded ? "Ocultar socios" : "Elegir socio", variant: .text) {
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
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            Text("Calendario de reparto")
                .font(tokens.typography.titleCard)
                .foregroundStyle(tokens.colors.textPrimary)
            Text("Dia por defecto: \(defaultDeliveryDayOfWeek?.spanishLabel ?? "sin configurar")")
                .font(tokens.typography.body.weight(.semibold))
                .foregroundStyle(tokens.colors.textPrimary)

            if isLoadingDeliveryCalendar {
                Text("Cargando calendario...")
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
            } else if futureDeliveryWeeks.isEmpty {
                Text("No hay semanas de reparto futuras en los turnos cargados.")
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
            } else {
                HStack(spacing: tokens.spacing.sm) {
                    ReguertaButton("Cambiar dia de reparto", fullWidth: false) {
                        isDeliveryCalendarWeekPickerPresented = true
                    }
                    ReguertaButton("Recargar", variant: .text, fullWidth: false, action: onRefreshDeliveryCalendar)
                }
                Text("Primero eliges la semana a cambiar y despues editas solo esa excepcion.")
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
            Text("Planificacion de turnos")
                .font(tokens.typography.titleCard)
                .foregroundStyle(tokens.colors.textPrimary)
            Text("Genera una temporada nueva con socios activos, escribe la hoja nueva y avisa a los socios asignados.")
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.textSecondary)
            HStack(spacing: tokens.spacing.sm) {
                ReguertaButton("Generar reparto", fullWidth: false) {
                    pendingShiftPlanningType = .delivery
                }
                ReguertaButton("Generar mercado", fullWidth: false) {
                    pendingShiftPlanningType = .market
                }
            }
            .disabled(isSubmittingShiftPlanningRequest)
            if isSubmittingShiftPlanningRequest {
                Text("Enviando solicitud de planificacion...")
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
            }
        }
        .alert(
            pendingShiftPlanningType == nil
                ? ""
                : "Generar turnos de \(pendingShiftPlanningType == .delivery ? "reparto" : "mercado")",
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
            Button("Cancelar", role: .cancel) {
                pendingShiftPlanningType = nil
            }
            Button("Confirmar") {
                onSubmitShiftPlanningRequest(type) {
                    pendingShiftPlanningType = nil
                }
            }
        } message: { _ in
            Text(
                "Se creara una planificacion nueva con socios activos, se escribira en la sheet de la temporada siguiente " +
                    "y se notificara a los socios asignados. Si vuelves a lanzarlo, se regenerara esa temporada."
            )
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
}
