import SwiftUI

enum DeliveryCalendarAdaptiveLayoutContract {
    private static let preferredDayControlSize: CGFloat = 46
    private static let standardActionMaximumWidth: CGFloat = 216
    static let borderWidth: CGFloat = 1

    static func dayControlSize(minimumTouchTarget: CGFloat) -> CGFloat {
        max(preferredDayControlSize, minimumTouchTarget)
    }

    static func usesStackedDayNavigation(isAccessibilitySize: Bool) -> Bool { isAccessibilitySize }

    static func prefersExpandedSheet(isAccessibilitySize: Bool) -> Bool { isAccessibilitySize }

    static func actionMaximumWidth(isAccessibilitySize: Bool) -> CGFloat? {
        isAccessibilitySize ? nil : standardActionMaximumWidth
    }

    static func selectableWeekdays(
        defaultWeekday: DeliveryWeekday,
        selectedWeekday: DeliveryWeekday
    ) -> [DeliveryWeekday] {
        DeliveryWeekday.allCases.filter {
            $0 == defaultWeekday || $0 == selectedWeekday || $0.isAllowedCalendarException
        }
    }
}

struct DeliveryCalendarWeekPickerSheet: View {
    @Environment(\.reguertaTokens) private var tokens
    @Environment(\.dismiss) private var dismiss
    let futureWeeks: [ShiftAssignment]
    let overrides: [DeliveryCalendarOverride]
    let defaultWeekday: DeliveryWeekday
    @Binding var selectedWeekKey: String
    @Binding var selectedWeekday: DeliveryWeekday
    let overrideEntry: DeliveryCalendarOverride?
    let isSaving: Bool
    let hasDayChange: Bool
    let onSave: () -> Void

    var body: some View {
        NavigationStack {
            ScrollView(.vertical, showsIndicators: true) {
                VStack(alignment: .leading, spacing: tokens.spacing.lg) {
                    Text(
                        localizedKey(
                            overrideEntry == nil
                                ? AccessL10nKey.deliveryCalendarWeekPickerSubtitle
                                : AccessL10nKey.deliveryCalendarWeekPickerOverrideSubtitle
                        )
                    )
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .fixedSize(horizontal: false, vertical: true)
                        .layoutPriority(1)
                    Picker(
                        localizedKey(AccessL10nKey.deliveryCalendarWeekPickerFieldWeek),
                        selection: $selectedWeekKey
                    ) {
                        ForEach(futureWeeks, id: \.weekKey) { shift in
                            Text("\(shift.weekKey) · \(effectiveDateLabel(for: shift))")
                                .tag(shift.weekKey)
                        }
                    }
                    .pickerStyle(.wheel)
                    .frame(maxWidth: .infinity)
                    .frame(height: 180)
                    .clipped()

                    DeliveryDayNavigationControl(
                        tokens: tokens,
                        defaultWeekday: defaultWeekday,
                        selectedWeekday: $selectedWeekday,
                        isSaving: isSaving
                    )
                }
                .padding(tokens.spacing.lg)
            }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                reguertaButton(
                    localizedKey(AccessL10nKey.deliveryCalendarEditorActionSaveException),
                    isEnabled: hasDayChange && !isSaving,
                    isLoading: isSaving,
                    action: onSave
                )
                .padding(.horizontal, tokens.spacing.lg)
                .padding(.vertical, tokens.spacing.sm)
                .background(tokens.colors.surfacePrimary)
            }
            .navigationTitle(localizedKey(AccessL10nKey.deliveryCalendarEditorNavTitle))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                    }
                    .disabled(isSaving)
                    .accessibilityLabel(localizedKey(AccessL10nKey.commonActionClose))
                }
            }
        }
        .interactiveDismissDisabled(isSaving)
    }

    private func localizedDateOnly(_ millis: Int64) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: Date(timeIntervalSince1970: TimeInterval(millis) / 1_000))
    }

    private func effectiveDateLabel(for shift: ShiftAssignment) -> String {
        let effectiveMillis = overrides.first(where: { $0.weekKey == shift.weekKey })?.deliveryDateMillis ??
            shift.dateMillis
        return localizedDateOnly(effectiveMillis)
    }

    private func localizedKey(_ key: String) -> LocalizedStringKey { LocalizedStringKey(key) }
}

private struct DeliveryDayNavigationControl: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let tokens: ReguertaDesignTokens
    let defaultWeekday: DeliveryWeekday
    @Binding var selectedWeekday: DeliveryWeekday
    let isSaving: Bool

    private var selectableWeekdays: [DeliveryWeekday] {
        DeliveryCalendarAdaptiveLayoutContract.selectableWeekdays(
            defaultWeekday: defaultWeekday,
            selectedWeekday: selectedWeekday
        )
    }

    private var canGoPrevious: Bool {
        guard let index = selectableWeekdays.firstIndex(of: selectedWeekday) else { return false }
        return index > 0 && !isSaving
    }

    private var canGoNext: Bool {
        guard let index = selectableWeekdays.firstIndex(of: selectedWeekday) else { return false }
        return index < selectableWeekdays.count - 1 && !isSaving
    }

    var body: some View {
        let layout = DeliveryCalendarAdaptiveLayoutContract.usesStackedDayNavigation(
            isAccessibilitySize: dynamicTypeSize.isAccessibilitySize
        )
            ? AnyLayout(VStackLayout(spacing: tokens.spacing.sm))
            : AnyLayout(HStackLayout(spacing: tokens.spacing.md))

        layout {
            DeliveryDayNavigationButton(
                tokens: tokens,
                systemImageName: "chevron.left",
                isEnabled: canGoPrevious,
                accessibilityLabel: localizedKey(AccessL10nKey.deliveryCalendarEditorActionPrevious),
                action: selectPrevious
            )

            Text(l10n(selectedWeekday.titleKey))
                .font(tokens.typography.body.weight(.semibold))
                .foregroundStyle(tokens.colors.actionPrimary)
                .padding(.horizontal, tokens.spacing.lg)
                .frame(
                    maxWidth: .infinity,
                    minHeight: DeliveryCalendarAdaptiveLayoutContract.dayControlSize(
                        minimumTouchTarget: tokens.layout.minimumTouchTarget
                    )
                )
                .deliveryDayGlassBackground(tokens: tokens, shape: Capsule(), isEnabled: true)

            DeliveryDayNavigationButton(
                tokens: tokens,
                systemImageName: "chevron.right",
                isEnabled: canGoNext,
                accessibilityLabel: localizedKey(AccessL10nKey.deliveryCalendarEditorActionNext),
                action: selectNext
            )
        }
        .frame(maxWidth: .infinity)
    }

    private func selectPrevious() {
        guard let index = selectableWeekdays.firstIndex(of: selectedWeekday), index > 0 else { return }
        selectedWeekday = selectableWeekdays[index - 1]
    }

    private func selectNext() {
        guard let index = selectableWeekdays.firstIndex(of: selectedWeekday),
              index < selectableWeekdays.count - 1 else { return }
        selectedWeekday = selectableWeekdays[index + 1]
    }

    private func localizedKey(_ key: String) -> LocalizedStringKey { LocalizedStringKey(key) }
}

private struct DeliveryDayNavigationButton: View {
    let tokens: ReguertaDesignTokens
    let systemImageName: String
    let isEnabled: Bool
    let accessibilityLabel: LocalizedStringKey
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImageName)
                .font(.system(size: tokens.icons.standard, weight: .bold))
                .frame(
                    width: DeliveryCalendarAdaptiveLayoutContract.dayControlSize(
                        minimumTouchTarget: tokens.layout.minimumTouchTarget
                    ),
                    height: DeliveryCalendarAdaptiveLayoutContract.dayControlSize(
                        minimumTouchTarget: tokens.layout.minimumTouchTarget
                    )
                )
        }
        .buttonStyle(.plain)
        .foregroundStyle(isEnabled ? tokens.colors.actionPrimary : tokens.colors.textSecondary.opacity(0.45))
        .disabled(!isEnabled)
        .accessibilityLabel(accessibilityLabel)
        .deliveryDayGlassBackground(tokens: tokens, shape: Circle(), isEnabled: isEnabled)
    }
}

private extension View {
    @ViewBuilder
    func deliveryDayGlassBackground<S: Shape>(
        tokens: ReguertaDesignTokens,
        shape: S,
        isEnabled: Bool
    ) -> some View {
        if #available(iOS 26.0, *) {
            if isEnabled {
                self
                    .background(tokens.colors.surfacePrimary, in: shape)
                    .glassEffect(
                        .regular.tint(
                            tokens.colors.actionPrimary.opacity(
                                ReguertaContrastContract.maximumActionTintOpacity
                            )
                        ),
                        in: shape
                    )
            } else {
                self
                    .background(tokens.colors.surfacePrimary, in: shape)
                    .glassEffect(
                        .regular.tint(tokens.colors.actionPrimary.opacity(0.05)),
                        in: shape
                    )
            }
        } else {
            self
                .background(tokens.colors.actionPrimary.opacity(isEnabled ? 0.14 : 0.06), in: shape)
                .background(tokens.colors.surfacePrimary, in: shape)
                .overlay(
                    shape.stroke(
                        tokens.colors.borderSubtle.opacity(isEnabled ? 0.75 : 0.35),
                        lineWidth: DeliveryCalendarAdaptiveLayoutContract.borderWidth
                    )
                )
        }
    }
}

struct SettingsDeliveryCalendarSectionView: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let tokens: ReguertaDesignTokens
    let shiftsViewModel: ShiftsFeatureViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            Text(localizedKey(AccessL10nKey.settingsDeliveryCalendarTitle))
                .font(tokens.typography.titleCard)
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
                Text(localizedKey(AccessL10nKey.settingsDeliveryCalendarHelp))
                    .font(tokens.typography.label)
                    .foregroundStyle(tokens.colors.textSecondary)
                reguertaButton(
                    localizedKey(AccessL10nKey.settingsDeliveryCalendarActionChangeDay),
                    action: shiftsViewModel.openCalendarWeekPicker
                )
                .frame(
                    maxWidth: DeliveryCalendarAdaptiveLayoutContract.actionMaximumWidth(
                        isAccessibilitySize: dynamicTypeSize.isAccessibilitySize
                    ),
                    alignment: .center
                )
            }
        }
        .sheet(
            isPresented: weekPickerPresentedBinding,
            onDismiss: shiftsViewModel.dismissCalendarEditor
        ) {
            DeliveryCalendarWeekPickerSheet(
                futureWeeks: shiftsViewModel.futureDeliveryWeeks,
                overrides: shiftsViewModel.deliveryCalendarOverrides,
                defaultWeekday: shiftsViewModel.defaultDeliveryDayOfWeek ?? .wednesday,
                selectedWeekKey: selectedWeekBinding,
                selectedWeekday: selectedWeekdayBinding,
                overrideEntry: shiftsViewModel.selectedDeliveryCalendarOverride,
                isSaving: shiftsViewModel.isSavingDeliveryCalendar,
                hasDayChange: shiftsViewModel.hasDeliveryCalendarDayChange,
                onSave: saveOverride
            )
            .presentationDetents(calendarSheetDetents)
        }
    }

    private var calendarSheetDetents: Set<PresentationDetent> {
        DeliveryCalendarAdaptiveLayoutContract.prefersExpandedSheet(
            isAccessibilitySize: dynamicTypeSize.isAccessibilitySize
        ) ? [.large] : [.medium, .large]
    }

    private var weekPickerPresentedBinding: Binding<Bool> {
        Binding(
            get: { shiftsViewModel.isDeliveryCalendarWeekPickerPresented },
            set: { shiftsViewModel.isDeliveryCalendarWeekPickerPresented = $0 }
        )
    }

    private var selectedWeekBinding: Binding<String> {
        Binding(
            get: {
                shiftsViewModel.selectedDeliveryCalendarWeekKey ??
                    shiftsViewModel.futureDeliveryWeeks.first?.weekKey ??
                    ""
            },
            set: { shiftsViewModel.selectCalendarWeekForEditing($0) }
        )
    }

    private var selectedWeekdayBinding: Binding<DeliveryWeekday> {
        Binding(
            get: { shiftsViewModel.selectedDeliveryCalendarWeekday },
            set: { shiftsViewModel.selectedDeliveryCalendarWeekday = $0 }
        )
    }

    private func saveOverride() {
        Task { await shiftsViewModel.saveDeliveryCalendarOverride() }
    }

    private func localizedKey(_ key: String) -> LocalizedStringKey { LocalizedStringKey(key) }
}
