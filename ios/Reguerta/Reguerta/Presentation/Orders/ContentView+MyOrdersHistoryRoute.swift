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

private struct OrderHistoryWeekHeader: View {
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
        .accessibilityIdentifier("myOrdersHistory.weekPickerButton")
        .weekGlassBackground(tokens: tokens, shape: Capsule(), isEnabled: true)
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

private struct OrderHistoryWeekPickerSheet: View {
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

private struct OrderHistoryWeekPickerLabel: View {
    let tokens: ReguertaDesignTokens
    let week: OrderHistoryWeekOption

    var body: some View {
        (
            Text(week.rangeLabel)
                .font(tokens.typography.titleCard.weight(.semibold))
            + Text(" · \(week.shortYearWeekLabel)")
                .font(tokens.typography.bodySecondary.weight(.semibold))
        )
        .foregroundStyle(tokens.colors.textPrimary)
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
