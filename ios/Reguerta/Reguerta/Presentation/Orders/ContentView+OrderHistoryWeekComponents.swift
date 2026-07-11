import SwiftUI

struct OrderHistoryWeekPresentation: Equatable {
    let rangeLabel: String
    let title: String
    let shortYearWeekLabel: String
    let pickerLabel: String
    let orderTitle: String
}

func orderHistoryWeekPresentation(
    _ week: OrderHistoryWeekOption,
    locale: Locale,
    weekLabel: String,
    shortWeekLabel: String,
    orderLabel: String
) -> OrderHistoryWeekPresentation {
    let rangeLabel = orderHistoryWeekOption(weekKey: week.weekKey, locale: locale)?.rangeLabel ?? week.rangeLabel
    let title = "\(week.weekYear) \(weekLabel) \(week.weekNumber)"
    let shortYearWeekLabel = "\(week.weekYear) \(shortWeekLabel) \(week.weekNumber)"
    return OrderHistoryWeekPresentation(
        rangeLabel: rangeLabel,
        title: title,
        shortYearWeekLabel: shortYearWeekLabel,
        pickerLabel: "\(rangeLabel) · \(shortYearWeekLabel)",
        orderTitle: "\(orderLabel) \(rangeLabel)"
    )
}

func localizedGenericOrderHistoryQuantityLabel(
    _ rawLabel: String,
    singleLabel: String,
    pluralFormat: String
) -> String {
    let pattern = #"^\s*(\d+)\s+ud(?:s|\(s\))?\.?\s*$"#
    guard let expression = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else {
        return rawLabel
    }
    let fullRange = NSRange(rawLabel.startIndex..<rawLabel.endIndex, in: rawLabel)
    guard let match = expression.firstMatch(in: rawLabel, range: fullRange),
          let quantityRange = Range(match.range(at: 1), in: rawLabel),
          let quantity = Int64(rawLabel[quantityRange]) else {
        return rawLabel
    }
    return quantity == 1 ? singleLabel : String(format: pluralFormat, quantity)
}

struct OrderHistoryWeekHeader: View {
    let tokens: ReguertaDesignTokens
    let selectedWeek: OrderHistoryWeekOption?
    let canGoPrevious: Bool
    let canGoNext: Bool
    let onPrevious: () -> Void
    let onNext: () -> Void
    let onPickWeek: () -> Void

    @Environment(\.locale) private var locale

    private var presentationLocale: Locale {
        reguertaPresentationLocale(fallback: locale)
    }

    private var selectedWeekPresentation: OrderHistoryWeekPresentation? {
        selectedWeek.map {
            orderHistoryWeekPresentation(
                $0,
                locale: presentationLocale,
                weekLabel: l10n(AccessL10nKey.orderHistoryWeek),
                shortWeekLabel: l10n(AccessL10nKey.orderHistoryWeekShort),
                orderLabel: l10n(AccessL10nKey.orderHistoryOrder)
            )
        }
    }

    var body: some View {
        VStack(alignment: .center, spacing: tokens.spacing.sm) {
            HStack(spacing: tokens.spacing.sm) {
                GlassWeekNavigationButton(
                    tokens: tokens,
                    systemImageName: "chevron.left",
                    isEnabled: canGoPrevious,
                    accessibilityLabel: l10n(AccessL10nKey.orderHistoryPreviousWeek),
                    action: onPrevious
                )

                GlassWeekPickerButton(
                    tokens: tokens,
                    title: selectedWeekPresentation?.title ?? l10n(AccessL10nKey.orderHistoryWeek),
                    action: onPickWeek
                )

                GlassWeekNavigationButton(
                    tokens: tokens,
                    systemImageName: "chevron.right",
                    isEnabled: canGoNext,
                    accessibilityLabel: l10n(AccessL10nKey.orderHistoryNextWeek),
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

    @Environment(\.locale) private var locale

    private var presentationLocale: Locale {
        reguertaPresentationLocale(fallback: locale)
    }

    var body: some View {
        VStack(spacing: tokens.spacing.md) {
            HStack {
                reguertaButton(
                    LocalizedStringKey(AccessL10nKey.commonActionCancel),
                    variant: .text,
                    fullWidth: false,
                    action: onCancel
                )
                Spacer()
                reguertaButton(
                    LocalizedStringKey(AccessL10nKey.orderHistorySelect),
                    fullWidth: false,
                    action: onDone
                )
            }
            .padding(.horizontal, tokens.spacing.lg)
            .padding(.top, tokens.spacing.md)

            Picker(l10n(AccessL10nKey.orderHistoryWeek), selection: $selection) {
                ForEach(weeks) { week in
                    OrderHistoryWeekPickerLabel(
                        tokens: tokens,
                        presentation: orderHistoryWeekPresentation(
                            week,
                            locale: presentationLocale,
                            weekLabel: l10n(AccessL10nKey.orderHistoryWeek),
                            shortWeekLabel: l10n(AccessL10nKey.orderHistoryWeekShort),
                            orderLabel: l10n(AccessL10nKey.orderHistoryOrder)
                        )
                    )
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
    let presentation: OrderHistoryWeekPresentation

    var body: some View {
        HStack(spacing: 0) {
            Text(presentation.rangeLabel)
                .font(tokens.typography.titleCard.weight(.semibold))
            Text(" · \(presentation.shortYearWeekLabel)")
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
