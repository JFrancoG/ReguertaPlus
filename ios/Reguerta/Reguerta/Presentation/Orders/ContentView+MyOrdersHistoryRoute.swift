import SwiftUI

struct MyOrdersHistoryRouteView: View {
    let tokens: ReguertaDesignTokens
    let viewModel: MyOrdersHistoryRouteViewModel
    let context: MyOrdersHistoryRouteContext
    let onTitleChanged: (String?) -> Void

    @Environment(\.locale) private var locale

    private var presentationLocale: Locale {
        reguertaPresentationLocale(fallback: locale)
    }

    private var selectedWeekPresentation: OrderHistoryWeekPresentation? {
        viewModel.selectedWeek.map {
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
        VStack(alignment: .leading, spacing: tokens.spacing.md) {
            OrderHistoryWeekHeader(
                tokens: tokens,
                selectedWeek: viewModel.selectedWeek,
                canGoPrevious: viewModel.canGoPrevious,
                canGoNext: viewModel.canGoNext,
                onPrevious: {
                    Task { await viewModel.selectPreviousWeek() }
                },
                onNext: {
                    Task { await viewModel.selectNextWeek() }
                },
                onPickWeek: viewModel.presentWeekPicker
            )

            routeContent
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if !viewModel.isWeekPickerPresented, case .loaded(let snapshot) = viewModel.loadState {
                OrderSummaryTotalBar(
                    tokens: tokens,
                    text: l10n(
                        AccessL10nKey.orderHistoryOrderTotalFormat,
                        snapshot.total.euroCurrencyText(locale: presentationLocale)
                    )
                )
                .accessibilityIdentifier("myOrdersHistory.totalBar")
            }
        }
        .task(id: context.identity) {
            await viewModel.appear(context: context)
            onTitleChanged(selectedWeekPresentation?.orderTitle)
        }
        .onChange(of: selectedWeekPresentation?.orderTitle) { _, title in
            onTitleChanged(title)
        }
        .onDisappear {
            onTitleChanged(nil)
        }
        .sheet(
            isPresented: Binding(
                get: { viewModel.isWeekPickerPresented },
                set: { isPresented in
                    if !isPresented {
                        viewModel.dismissWeekPicker()
                    }
                }
            )
        ) {
            OrderHistoryWeekPickerSheet(
                tokens: tokens,
                weeks: viewModel.availableWeeks,
                selection: Binding(
                    get: { viewModel.pickerSelectedWeekKey ?? viewModel.selectedWeekKey ?? "" },
                    set: { viewModel.pickerSelectedWeekKey = $0 }
                ),
                onCancel: viewModel.dismissWeekPicker,
                onDone: {
                    Task {
                        await viewModel.commitPickerSelection()
                    }
                }
            )
            .presentationDetents([.medium])
            .presentationBackground(tokens.colors.surfacePrimary)
        }
    }

    @ViewBuilder
    private var routeContent: some View {
        switch viewModel.loadState {
        case .idle, .loading:
            ProgressView()
                .tint(tokens.colors.actionPrimary)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
                .accessibilityIdentifier("myOrdersHistory.loadingIndicator")

        case .empty:
            Text(l10n(AccessL10nKey.orderHistoryEmpty))
                .font(tokens.typography.body)
                .foregroundStyle(tokens.colors.feedbackError)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.horizontal, tokens.spacing.lg)
                .padding(.vertical, tokens.spacing.xl)

        case .error:
            reguertaCard {
                VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                    Text(l10n(AccessL10nKey.orderHistoryError))
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)
                    reguertaButton(
                        LocalizedStringKey(AccessL10nKey.orderHistoryRetry),
                        variant: .text,
                        fullWidth: false
                    ) {
                        Task {
                            await viewModel.retry()
                        }
                    }
                }
            }

        case .loaded(let snapshot):
            OrderSummaryList(
                tokens: tokens,
                groups: snapshot.groups,
                locale: presentationLocale
            )
        }
    }
}

private struct OrderSummaryList: View {
    let tokens: ReguertaDesignTokens
    let groups: [MyOrderPreviousOrderGroup]
    let locale: Locale

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            LazyVStack(spacing: tokens.spacing.md) {
                ForEach(groups) { group in
                    PersonalOrderSummaryProducerCard(
                        tokens: tokens,
                        companyName: group.companyName,
                        statusText: nil,
                        lines: group.lines.map { line in
                            PersonalOrderSummaryLineContent(
                                id: line.id,
                                productName: line.productName,
                                packagingLine: line.packagingLine,
                                quantityText: localizedGenericOrderHistoryQuantityLabel(
                                    line.quantityLabel,
                                    singleLabel: l10n(AccessL10nKey.orderHistoryQuantitySingle),
                                    pluralFormat: l10n(AccessL10nKey.orderHistoryQuantityPluralFormat)
                                ),
                                subtotalText: line.subtotal.euroCurrencyText(locale: locale)
                            )
                        },
                        totalText: l10n(
                            AccessL10nKey.orderHistoryProducerTotalFormat,
                            group.subtotal.euroCurrencyText(locale: locale)
                        )
                    )
                }
            }
            .padding(.bottom, tokens.spacing.sm)
        }
    }
}

private struct OrderSummaryTotalBar: View {
    let tokens: ReguertaDesignTokens
    let text: String

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: tokens.radius.sm, style: .continuous)

        HStack {
            Text(text)
                .font(tokens.typography.body.weight(.semibold))
                .foregroundStyle(tokens.colors.actionOnPrimary)
                .frame(maxWidth: .infinity)
        }
        .padding(.horizontal, tokens.spacing.md)
        .frame(minHeight: tokens.layout.minimumTouchTarget)
        .background(shape.fill(tokens.colors.actionPrimary))
        .overlay(
            shape.stroke(tokens.colors.borderSubtle.opacity(0.65), lineWidth: 1)
        )
        .clipShape(shape)
        .padding(.horizontal, tokens.spacing.sm)
        .padding(.bottom, tokens.spacing.sm)
        .allowsHitTesting(false)
    }
}
