import SwiftUI

struct PersonalOrderSummaryProducerCard: View {
    let tokens: ReguertaDesignTokens
    let group: MyOrderPreviousOrderGroup
    let locale: Locale
    let quantitySingleLabel: String
    let quantityPluralFormat: String
    let producerTotalKey: String

    var body: some View {
        reguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(group.companyName)
                    .font(tokens.typography.titleCard.weight(.semibold))
                    .foregroundStyle(tokens.colors.actionPrimary)

                summaryDivider

                ForEach(group.lines) { line in
                    PersonalOrderSummaryLineRow(
                        tokens: tokens,
                        line: line,
                        quantityText: localizedGenericOrderHistoryQuantityLabel(
                            line.quantityLabel,
                            singleLabel: quantitySingleLabel,
                            pluralFormat: quantityPluralFormat
                        ),
                        subtotalText: line.subtotal.euroCurrencyText(locale: locale)
                    )
                }

                summaryDivider

                Text(
                    l10n(
                        producerTotalKey,
                        group.subtotal.euroCurrencyText(locale: locale)
                    )
                )
                    .font(tokens.typography.body.weight(.semibold))
                    .foregroundStyle(Color(red: 0.78, green: 0.38, blue: 0.36))
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
    }

    private var summaryDivider: some View {
        Divider()
            .overlay(tokens.colors.borderSubtle)
            .accessibilityHidden(true)
    }
}

private struct PersonalOrderSummaryLineRow: View {
    let tokens: ReguertaDesignTokens
    let line: MyOrderPreviousOrderLine
    let quantityText: String
    let subtotalText: String

    var body: some View {
        HStack(spacing: 0) {
            VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                Text(line.productName)
                    .font(tokens.typography.body.weight(.semibold))
                    .foregroundStyle(tokens.colors.textPrimary)
                    .lineLimit(2)
                Text(line.packagingLine)
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.trailing, tokens.spacing.sm)

            columnDivider

            Text(quantityText)
                .font(tokens.typography.body.weight(.semibold))
                .foregroundStyle(tokens.colors.textPrimary)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.8)
                .padding(.horizontal, tokens.spacing.xs)
                .frame(width: 72.resize)

            columnDivider

            Text(subtotalText)
                .font(tokens.typography.body.weight(.semibold))
                .foregroundStyle(tokens.colors.textPrimary)
                .multilineTextAlignment(.trailing)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
                .padding(.leading, tokens.spacing.sm)
                .frame(width: 82.resize, alignment: .trailing)
        }
        .frame(maxWidth: .infinity)
        .frame(minHeight: 64.resize)
        .accessibilityElement(children: .combine)
    }

    private var columnDivider: some View {
        Divider()
            .overlay(tokens.colors.borderSubtle)
            .accessibilityHidden(true)
    }
}
