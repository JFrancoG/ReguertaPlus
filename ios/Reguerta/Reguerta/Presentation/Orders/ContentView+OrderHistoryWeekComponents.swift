import SwiftUI

struct OrderHistoryWeekHeader: View {
    let tokens: ReguertaDesignTokens
    let selectedWeek: OrderHistoryWeekOption?
    let canGoPrevious: Bool
    let canGoNext: Bool
    let onPrevious: () -> Void
    let onNext: () -> Void
    let onPickWeek: () -> Void

    var body: some View {
        VStack(alignment: .center, spacing: tokens.spacing.sm) {
            HStack(spacing: tokens.spacing.sm) {
                GlassWeekNavigationButton(
                    tokens: tokens,
                    systemImageName: "chevron.left",
                    isEnabled: canGoPrevious,
                    accessibilityLabel: "Semana anterior",
                    action: onPrevious
                )

                GlassWeekPickerButton(
                    tokens: tokens,
                    title: selectedWeek?.title ?? "Semana",
                    action: onPickWeek
                )

                GlassWeekNavigationButton(
                    tokens: tokens,
                    systemImageName: "chevron.right",
                    isEnabled: canGoNext,
                    accessibilityLabel: "Semana posterior",
                    action: onNext
                )
            }
        }
        .frame(maxWidth: .infinity)
    }
}

struct OrderHistoryWeekPickerSheet: View {
    let tokens: ReguertaDesignTokens
    let weeks: [OrderHistoryWeekOption]
    @Binding var selection: String
    let onCancel: () -> Void
    let onDone: () -> Void

    var body: some View {
        VStack(spacing: tokens.spacing.md) {
            HStack {
                reguertaButton("Cancelar", variant: .text, fullWidth: false, action: onCancel)
                Spacer()
                reguertaButton("Seleccionar", fullWidth: false, action: onDone)
            }
            .padding(.horizontal, tokens.spacing.lg)
            .padding(.top, tokens.spacing.md)

            Picker("Semana", selection: $selection) {
                ForEach(weeks) { week in
                    OrderHistoryWeekPickerLabel(tokens: tokens, week: week)
                        .tag(week.weekKey)
                }
            }
            .pickerStyle(.wheel)
            .frame(maxWidth: .infinity)
        }
    }
}

private struct GlassWeekNavigationButton: View {
    let tokens: ReguertaDesignTokens
    let systemImageName: String
    let isEnabled: Bool
    let accessibilityLabel: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImageName)
                .font(.system(size: 20.resize, weight: .bold))
                .frame(width: 46.resize, height: 46.resize)
        }
        .buttonStyle(.plain)
        .foregroundStyle(isEnabled ? tokens.colors.actionPrimary : tokens.colors.textSecondary.opacity(0.45))
        .disabled(!isEnabled)
        .accessibilityLabel(accessibilityLabel)
        .weekGlassBackground(tokens: tokens, shape: Circle(), isEnabled: isEnabled)
    }
}

private struct GlassWeekPickerButton: View {
    let tokens: ReguertaDesignTokens
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(tokens.typography.body.weight(.semibold))
                .foregroundStyle(tokens.colors.actionPrimary)
                .padding(.horizontal, tokens.spacing.lg)
                .frame(minWidth: 154.resize, minHeight: 46.resize)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("orderHistory.weekPickerButton")
        .weekGlassBackground(tokens: tokens, shape: Capsule(), isEnabled: true)
    }
}

private struct OrderHistoryWeekPickerLabel: View {
    let tokens: ReguertaDesignTokens
    let week: OrderHistoryWeekOption

    var body: some View {
        HStack(spacing: 0) {
            Text(week.rangeLabel)
                .font(tokens.typography.titleCard.weight(.semibold))
            Text(" · \(week.shortYearWeekLabel)")
                .font(tokens.typography.bodySecondary.weight(.semibold))
        }
        .frame(maxWidth: .infinity, alignment: .center)
        .foregroundStyle(tokens.colors.textPrimary)
    }
}

private extension View {
    @ViewBuilder
    func weekGlassBackground<S: Shape>(
        tokens: ReguertaDesignTokens,
        shape: S,
        isEnabled: Bool
    ) -> some View {
        if #available(iOS 26.0, *) {
            if isEnabled {
                self
                    .glassEffect(
                        .regular.tint(tokens.colors.actionPrimary.opacity(0.16)).interactive(),
                        in: shape
                    )
            } else {
                self
                    .glassEffect(
                        .regular.tint(tokens.colors.actionPrimary.opacity(0.05)),
                        in: shape
                    )
            }
        } else {
            self
                .background(
                    shape.fill(tokens.colors.actionPrimary.opacity(isEnabled ? 0.14 : 0.06))
                )
                .overlay(
                    shape.stroke(tokens.colors.borderSubtle.opacity(isEnabled ? 0.75 : 0.35), lineWidth: 1.resize)
                )
        }
    }
}
