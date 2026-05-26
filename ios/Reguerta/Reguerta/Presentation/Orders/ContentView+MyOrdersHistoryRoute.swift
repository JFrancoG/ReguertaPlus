import SwiftUI

struct MyOrdersHistoryRouteView: View {
    let tokens: ReguertaDesignTokens
    let viewModel: MyOrdersHistoryRouteViewModel
    let context: MyOrdersHistoryRouteContext
    let onTitleChanged: (String?) -> Void

    var body: some View {
        ZStack(alignment: .bottom) {
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

            if !viewModel.isWeekPickerPresented, case .loaded(let snapshot) = viewModel.loadState {
                OrderSummaryTotalBar(
                    tokens: tokens,
                    text: "Suma total pedido: \(snapshot.total.euroCurrencyText())"
                )
                .accessibilityIdentifier("myOrdersHistory.totalBar")
            }
        }
        .task(id: context.identity) {
            await viewModel.appear(context: context)
            onTitleChanged(viewModel.selectedWeek?.orderTitle)
        }
        .onChange(of: viewModel.selectedWeek?.orderTitle) { _, title in
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
            .presentationDetents([.height(320.resize)])
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
            Text("No hay ningún pedido registrado para esta semana")
                .font(tokens.typography.body)
                .foregroundStyle(tokens.colors.feedbackError)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.horizontal, tokens.spacing.lg)
                .padding(.vertical, tokens.spacing.xl)

        case .error:
            reguertaCard {
                VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                    Text("No hemos podido cargar este pedido.")
                        .font(tokens.typography.bodySecondary)
                        .foregroundStyle(tokens.colors.textSecondary)
                    reguertaButton("Reintentar", variant: .text, fullWidth: false) {
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
                bottomPadding: 72.resize + 8.resizeBottomSize
            )
        }
    }
}

private struct OrderSummaryList: View {
    let tokens: ReguertaDesignTokens
    let groups: [MyOrderPreviousOrderGroup]
    let bottomPadding: CGFloat

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            LazyVStack(spacing: tokens.spacing.md) {
                ForEach(groups) { group in
                    OrderSummaryProducerCard(tokens: tokens, group: group)
                }
            }
            .padding(.bottom, bottomPadding)
        }
        .ignoresSafeArea(.container, edges: .bottom)
    }
}

private struct OrderSummaryProducerCard: View {
    let tokens: ReguertaDesignTokens
    let group: MyOrderPreviousOrderGroup

    var body: some View {
        reguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(group.companyName)
                    .font(tokens.typography.titleCard.weight(.semibold))
                    .foregroundStyle(tokens.colors.actionPrimary)

                Divider()
                    .overlay(tokens.colors.borderSubtle)

                ForEach(group.lines) { line in
                    HStack(alignment: .firstTextBaseline, spacing: tokens.spacing.sm) {
                        VStack(alignment: .leading, spacing: tokens.spacing.xs) {
                            Text(line.productName)
                                .font(tokens.typography.body.weight(.semibold))
                                .foregroundStyle(tokens.colors.textPrimary)
                            Text(line.packagingLine)
                                .font(tokens.typography.bodySecondary)
                                .foregroundStyle(tokens.colors.textSecondary)
                        }
                        Spacer()
                        Text(line.quantityLabel)
                            .font(tokens.typography.body.weight(.semibold))
                            .foregroundStyle(tokens.colors.textPrimary)
                        Text(line.subtotal.euroCurrencyText())
                            .font(tokens.typography.body.weight(.semibold))
                            .foregroundStyle(tokens.colors.textPrimary)
                    }
                }

                Divider()
                    .overlay(tokens.colors.borderSubtle)

                HStack {
                    Spacer()
                    Text("Total: \(group.subtotal.euroCurrencyText())")
                        .font(tokens.typography.body.weight(.semibold))
                        .foregroundStyle(Color(red: 0.78, green: 0.38, blue: 0.36))
                }
            }
        }
    }
}

private struct OrderSummaryTotalBar: View {
    let tokens: ReguertaDesignTokens
    let text: String

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 8.resize, style: .continuous)

        HStack {
            Text(text)
                .font(tokens.typography.body.weight(.semibold))
                .foregroundStyle(tokens.colors.textPrimary)
                .frame(maxWidth: .infinity)
        }
        .padding(.horizontal, tokens.spacing.md)
        .frame(height: 44.resize)
        .background(shape.fill(tokens.colors.actionPrimary.opacity(0.7)))
        .overlay(
            shape.stroke(tokens.colors.borderSubtle.opacity(0.65), lineWidth: 1.resize)
        )
        .clipShape(shape)
        .padding(.horizontal, tokens.spacing.sm)
        .padding(.bottom, 8.resizeBottomSize)
        .allowsHitTesting(false)
    }
}
