import SwiftUI

struct DeliveryCalendarWeekPickerSheet: View {
    @Environment(\.reguertaTokens) private var tokens
    @Environment(\.dismiss) private var dismiss
    let futureWeeks: [ShiftAssignment]
    let overrides: [DeliveryCalendarOverride]
    let onSelectWeek: (String) -> Void
    @State private var selectedWeekKey: String

    init(
        futureWeeks: [ShiftAssignment],
        overrides: [DeliveryCalendarOverride],
        onSelectWeek: @escaping (String) -> Void
    ) {
        self.futureWeeks = futureWeeks
        self.overrides = overrides
        self.onSelectWeek = onSelectWeek
        _selectedWeekKey = State(initialValue: futureWeeks.first?.weekKey ?? "")
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: tokens.spacing.lg) {
                Text(localizedKey(AccessL10nKey.deliveryCalendarWeekPickerSubtitle))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
                Picker(localizedKey(AccessL10nKey.deliveryCalendarWeekPickerFieldWeek), selection: $selectedWeekKey) {
                    ForEach(futureWeeks, id: \.weekKey) { shift in
                        Text("\(shift.weekKey) · \(effectiveDateLabel(for: shift))")
                            .tag(shift.weekKey)
                    }
                }
                .pickerStyle(.wheel)
                .frame(maxWidth: .infinity)
                .frame(height: 180)
                .clipped()

                if let selectedShift = futureWeeks.first(where: { $0.weekKey == selectedWeekKey }) {
                    VStack(spacing: 4) {
                        Text(selectedShift.weekKey)
                            .font(tokens.typography.body.weight(.semibold))
                            .foregroundStyle(tokens.colors.textPrimary)
                        Text(effectiveDateLabel(for: selectedShift))
                            .font(tokens.typography.label)
                            .foregroundStyle(tokens.colors.textSecondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(tokens.spacing.md)
                    .background(tokens.colors.surfacePrimary)
                    .overlay(
                        RoundedRectangle(cornerRadius: tokens.radius.md)
                            .stroke(tokens.colors.borderSubtle, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: tokens.radius.md))
                }

                Spacer(minLength: 0)

                HStack(spacing: tokens.spacing.sm) {
                    ReguertaButton(localizedKey(AccessL10nKey.commonActionClose), variant: .text, fullWidth: false) {
                        dismiss()
                    }
                    ReguertaButton(localizedKey(AccessL10nKey.commonActionSelect), isEnabled: !selectedWeekKey.isEmpty, fullWidth: false) {
                        onSelectWeek(selectedWeekKey)
                    }
                }
            }
            .padding(tokens.spacing.lg)
            .navigationTitle(localizedKey(AccessL10nKey.deliveryCalendarWeekPickerNavTitle))
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func localizedDateOnly(_ millis: Int64) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale.current
        formatter.dateFormat = "d MMM yyyy"
        return formatter.string(from: Date(timeIntervalSince1970: TimeInterval(millis) / 1_000))
    }

    private func effectiveDateLabel(for shift: ShiftAssignment) -> String {
        let effectiveMillis = overrides.first(where: { $0.weekKey == shift.weekKey })?.deliveryDateMillis ?? shift.dateMillis
        return localizedDateOnly(effectiveMillis)
    }

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }
}

struct DeliveryCalendarEditorSheet: View {
    @Environment(\.reguertaTokens) private var tokens
    @Environment(\.dismiss) private var dismiss
    let shift: ShiftAssignment
    let overrideEntry: DeliveryCalendarOverride?
    let defaultDay: DeliveryWeekday
    let isSaving: Bool
    let onRefresh: () -> Void
    let onSave: (String, DeliveryWeekday) -> Void
    let onDelete: (String) -> Void
    @State private var selectedWeekday: DeliveryWeekday

    init(
        shift: ShiftAssignment,
        overrideEntry: DeliveryCalendarOverride?,
        defaultDay: DeliveryWeekday,
        isSaving: Bool,
        onRefresh: @escaping () -> Void,
        onSave: @escaping (String, DeliveryWeekday) -> Void,
        onDelete: @escaping (String) -> Void
    ) {
        self.shift = shift
        self.overrideEntry = overrideEntry
        self.defaultDay = defaultDay
        self.isSaving = isSaving
        self.onRefresh = onRefresh
        self.onSave = onSave
        self.onDelete = onDelete
        _selectedWeekday = State(initialValue: overrideEntry?.deliveryDateMillis.deliveryWeekday ?? defaultDay)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: tokens.spacing.md) {
                Spacer(minLength: 0)

                VStack(alignment: .leading, spacing: tokens.spacing.md) {
                    Text(localizedKey(AccessL10nKey.deliveryCalendarEditorSubtitle))
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)

                    VStack(spacing: 4) {
                        Text(shift.weekKey)
                            .font(tokens.typography.body.weight(.semibold))
                        Text(localizedDateOnly(overrideEntry?.deliveryDateMillis ?? shift.dateMillis))
                            .font(tokens.typography.label)
                            .foregroundStyle(tokens.colors.textSecondary)
                    }
                    .frame(maxWidth: .infinity)

                    VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                        Text(
                            overrideEntry.map { l10n(AccessL10nKey.deliveryCalendarEditorStatusActiveException, localizedDateOnly($0.deliveryDateMillis)) } ??
                            l10n(AccessL10nKey.deliveryCalendarEditorStatusNoException)
                        )
                        .font(tokens.typography.label)
                        .foregroundStyle(tokens.colors.textSecondary)

                        HStack(spacing: tokens.spacing.sm) {
                            ReguertaButton(localizedKey(AccessL10nKey.deliveryCalendarEditorActionPrevious), variant: .text, fullWidth: false) {
                                selectedWeekday = selectedWeekday.previous
                            }
                            Text(l10n(selectedWeekday.titleKey))
                                .font(tokens.typography.bodySecondary.weight(.semibold))
                            ReguertaButton(localizedKey(AccessL10nKey.deliveryCalendarEditorActionNext), variant: .text, fullWidth: false) {
                                selectedWeekday = selectedWeekday.next
                            }
                        }

                        ReguertaButton(localizedKey(AccessL10nKey.deliveryCalendarEditorActionSaveException), isEnabled: !isSaving, isLoading: isSaving) {
                            onSave(shift.weekKey, selectedWeekday)
                            dismiss()
                        }
                        if overrideEntry != nil {
                            ReguertaButton(localizedKey(AccessL10nKey.deliveryCalendarEditorActionRemoveException), variant: .text, isEnabled: !isSaving, fullWidth: false) {
                                onDelete(shift.weekKey)
                                dismiss()
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Spacer(minLength: 0)
            }
            .padding(tokens.spacing.lg)
            .navigationTitle(localizedKey(AccessL10nKey.deliveryCalendarEditorNavTitle))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(localizedKey(AccessL10nKey.commonActionClose)) { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(localizedKey(AccessL10nKey.commonActionReload)) { onRefresh() }
                }
            }
        }
    }

    private func localizedDateOnly(_ millis: Int64) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale.current
        formatter.dateFormat = "d MMM yyyy"
        return formatter.string(from: Date(timeIntervalSince1970: TimeInterval(millis) / 1_000))
    }

    private func localizedKey(_ key: String) -> LocalizedStringKey {
        LocalizedStringKey(key)
    }
}
