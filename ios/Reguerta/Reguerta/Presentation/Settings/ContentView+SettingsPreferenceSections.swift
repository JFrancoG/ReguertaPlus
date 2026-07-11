import SwiftUI

struct SettingsScopeHeaderView: View {
    let tokens: ReguertaDesignTokens
    let titleKey: String

    var body: some View {
        Text(LocalizedStringKey(titleKey))
            .font(tokens.typography.titleCard)
            .foregroundStyle(tokens.colors.actionPrimary)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct SettingsAppearanceSectionView: View {
    let tokens: ReguertaDesignTokens
    @Binding var appearanceRawValue: String

    private var normalizedAppearanceRawValue: Binding<String> {
        Binding(
            get: {
                AppAppearance(rawValue: appearanceRawValue)?.rawValue
                    ?? AppAppearance.system.rawValue
            },
            set: { appearanceRawValue = $0 }
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            Text(LocalizedStringKey(AccessL10nKey.settingsAppearanceTitle))
                .font(tokens.typography.body.weight(.semibold))
                .foregroundStyle(tokens.colors.textPrimary)
            Text(LocalizedStringKey(AccessL10nKey.settingsAppearanceSummary))
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.textSecondary)
            Picker(
                LocalizedStringKey(AccessL10nKey.settingsAppearanceTitle),
                selection: normalizedAppearanceRawValue
            ) {
                ForEach(AppAppearance.allCases) { appearance in
                    Text(LocalizedStringKey(appearance.titleKey))
                        .tag(appearance.rawValue)
                }
            }
            .pickerStyle(.segmented)
        }
    }
}

struct SettingsVacationModeSectionView: View {
    let tokens: ReguertaDesignTokens
    let isEnabled: Bool
    let isSaving: Bool
    let onChanged: (Bool) -> Void

    var body: some View {
        Toggle(
            isOn: Binding(
                get: { isEnabled },
                set: { newValue in onChanged(newValue) }
            )
        ) {
            VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                Text(LocalizedStringKey(AccessL10nKey.settingsVacationModeTitle))
                    .font(tokens.typography.body.weight(.semibold))
                    .foregroundStyle(tokens.colors.textPrimary)
                Text(LocalizedStringKey(AccessL10nKey.settingsVacationModeSummary))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .disabled(isSaving)
    }
}

struct SettingsDevelopSectionView: View {
    let tokens: ReguertaDesignTokens
    let session: AuthorizedSession
    @Binding var isImpersonationExpanded: Bool
    let nowOverrideMillis: Int64?
    let onClearImpersonation: () -> Void
    let onImpersonate: (String) -> Void
    let onSetNowOverrideMillis: (Int64?) -> Void
    let onShiftNowByDays: (Int) -> Void

    private var activeMembers: [Member] {
        session.members
            .filter(\.isActive)
            .sorted { lhs, rhs in
                lhs.displayName.localizedCaseInsensitiveCompare(rhs.displayName) == .orderedAscending
            }
    }

    private var isImpersonating: Bool {
        session.member.id != session.authenticatedMember.id
    }

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.md) {
            SettingsScopeHeaderView(tokens: tokens, titleKey: AccessL10nKey.settingsScopeDevelop)
            Text(LocalizedStringKey(AccessL10nKey.settingsSubtitleDevelopImpersonation))
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.textSecondary)
            impersonationSection
            Divider()
                .overlay(tokens.colors.borderSubtle)
            developmentTimeSection
        }
    }

    @ViewBuilder
    private var impersonationSection: some View {
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
            reguertaButton(
                LocalizedStringKey(AccessL10nKey.settingsImpersonationActionBackToRealProfile),
                action: onClearImpersonation
            )
        }

        Divider()
            .overlay(tokens.colors.borderSubtle)
        Text(LocalizedStringKey(AccessL10nKey.settingsImpersonationSectionTitle))
            .font(tokens.typography.titleCard)
            .foregroundStyle(tokens.colors.textPrimary)
        reguertaButton(
            LocalizedStringKey(
                isImpersonationExpanded
                    ? AccessL10nKey.settingsImpersonationActionHideMembers
                    : AccessL10nKey.settingsImpersonationActionSelectMember
            ),
            variant: .text
        ) {
            isImpersonationExpanded.toggle()
        }

        if isImpersonationExpanded {
            ForEach(activeMembers, id: \.id) { member in
                reguertaButton(LocalizedStringKey(member.displayName), variant: .text) {
                    onImpersonate(member.id)
                    isImpersonationExpanded = false
                }
                .disabled(member.id == session.member.id)
            }
        }
    }

    private var developmentTimeSection: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            Text(LocalizedStringKey(AccessL10nKey.settingsDevelopmentTimeTitle))
                .font(tokens.typography.titleCard)
                .foregroundStyle(tokens.colors.textPrimary)
            Text(
                nowOverrideMillis.map {
                    l10n(AccessL10nKey.settingsDevelopmentTimeSimulatedDate, localizedDateTime($0))
                } ?? l10n(AccessL10nKey.settingsDevelopmentTimeSimulatedDateDisabled)
            )
            .font(tokens.typography.bodySecondary)
            .foregroundStyle(tokens.colors.textSecondary)

            HStack(spacing: tokens.spacing.sm) {
                reguertaButton(
                    LocalizedStringKey(AccessL10nKey.settingsDevelopmentTimeActionPreviousDay),
                    variant: .text
                ) { onShiftNowByDays(-1) }
                reguertaButton(
                    LocalizedStringKey(AccessL10nKey.settingsDevelopmentTimeActionNextDay),
                    variant: .text
                ) { onShiftNowByDays(1) }
            }
            HStack(spacing: tokens.spacing.sm) {
                reguertaButton(
                    LocalizedStringKey(AccessL10nKey.settingsDevelopmentTimeActionNow),
                    variant: .text
                ) {
                    onSetNowOverrideMillis(Int64(Date().timeIntervalSince1970 * 1_000))
                }
                reguertaButton(
                    LocalizedStringKey(AccessL10nKey.settingsDevelopmentTimeActionReset),
                    variant: .text
                ) { onSetNowOverrideMillis(nil) }
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
}

extension AppAppearance {
    var titleKey: String {
        switch self {
        case .system:
            AccessL10nKey.settingsAppearanceSystem
        case .light:
            AccessL10nKey.settingsAppearanceLight
        case .dark:
            AccessL10nKey.settingsAppearanceDark
        }
    }
}
