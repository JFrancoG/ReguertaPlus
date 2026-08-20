import SwiftUI

struct PersonalOrderSummaryLineContent: Identifiable {
    let id: String
    let productName: String
    let packagingLine: String
    let quantityText: String
    let subtotalText: String
}

struct PersonalOrderSummaryProducerCard: View {
    let tokens: ReguertaDesignTokens
    let companyName: String
    let statusText: String?
    let lines: [PersonalOrderSummaryLineContent]
    let totalText: String

    var body: some View {
        reguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                HStack(spacing: tokens.spacing.sm) {
                    Text(companyName)
                        .font(tokens.typography.titleCard.weight(.semibold))
                        .foregroundStyle(tokens.colors.actionPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    if let statusText {
                        Text(statusText)
                            .font(tokens.typography.label.weight(.semibold))
                            .foregroundStyle(tokens.colors.textSecondary)
                    }
                }

                summaryDivider

                ForEach(lines) { line in
                    PersonalOrderSummaryLineRow(
                        tokens: tokens,
                        line: line
                    )
                }

                summaryDivider

                Text(totalText)
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
    let line: PersonalOrderSummaryLineContent

    var body: some View {
        ViewThatFits(in: .horizontal) {
            wideSummaryRow
            compactSummaryRow
        }
        .frame(maxWidth: .infinity)
        .frame(minHeight: OrderAdaptiveLayoutMetrics.summaryRowMinimumHeight)
        .accessibilityElement(children: .combine)
    }

    private var wideSummaryRow: some View {
        HStack(spacing: 0) {
            productDescription
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.trailing, tokens.spacing.sm)

            columnDivider

            Text(line.quantityText)
                .font(tokens.typography.body.weight(.semibold))
                .foregroundStyle(tokens.colors.textPrimary)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.8)
                .padding(.horizontal, tokens.spacing.xs)
                .frame(width: OrderAdaptiveLayoutMetrics.summaryQuantityColumnWidth)

            columnDivider

            Text(line.subtotalText)
                .font(tokens.typography.body.weight(.semibold))
                .foregroundStyle(tokens.colors.textPrimary)
                .multilineTextAlignment(.trailing)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
                .padding(.leading, tokens.spacing.sm)
                .frame(width: OrderAdaptiveLayoutMetrics.summarySubtotalColumnWidth, alignment: .trailing)
        }
    }

    private var compactSummaryRow: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.sm) {
            productDescription
            HStack(alignment: .firstTextBaseline, spacing: tokens.spacing.md) {
                Text(line.quantityText)
                    .font(tokens.typography.body.weight(.semibold))
                    .foregroundStyle(tokens.colors.textPrimary)
                Spacer(minLength: tokens.spacing.sm)
                Text(line.subtotalText)
                    .font(tokens.typography.body.weight(.semibold))
                    .foregroundStyle(tokens.colors.textPrimary)
            }
        }
    }

    private var productDescription: some View {
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
    }

    private var columnDivider: some View {
        Divider()
            .overlay(tokens.colors.borderSubtle)
            .accessibilityHidden(true)
    }
}
