import SwiftUI

struct ReceivedOrdersHistoryRouteView: View {
    let tokens: ReguertaDesignTokens
    let viewModel: ReceivedOrdersHistoryRouteViewModel
    let context: ReceivedOrdersHistoryRouteContext
    let onTitleChanged: (String?) -> Void

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

            tabSelector

            routeContent
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .task(id: context.identity) {
            await viewModel.appear(context: context)
            onTitleChanged(viewModel.selectedTitle)
        }
        .onChange(of: viewModel.selectedTitle) { _, title in
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
    private var tabSelector: some View {
        Picker(
            "Pedidos recibidos",
            selection: Binding(
                get: { viewModel.selectedTab },
                set: { tab in
                    withAnimation(.snappy(duration: 0.22)) {
                        viewModel.selectTab(tab)
                    }
                }
            )
        ) {
            ForEach(ReceivedOrdersTab.allCases) { tab in
                Text(tab.title)
                    .font(tokens.typography.label.weight(.semibold))
                    .tag(tab)
            }
        }
        .pickerStyle(.segmented)
        .tint(tokens.colors.actionPrimary)
        .accessibilityIdentifier("receivedOrdersHistory.tabSelector")
    }

    @ViewBuilder
    private var routeContent: some View {
        if !viewModel.isProducer {
            infoCard(
                title: "Solo para productores",
                body: "Esta sección aparece cuando accedes con un perfil productor."
            )
        } else {
            switch viewModel.loadState {
            case .idle, .loading:
                ProgressView()
                    .tint(tokens.colors.actionPrimary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
                    .accessibilityIdentifier("receivedOrdersHistory.loadingIndicator")

            case .empty:
                Text("No hay pedidos recibidos para esta semana")
                    .font(tokens.typography.body)
                    .foregroundStyle(tokens.colors.feedbackError)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.horizontal, tokens.spacing.lg)
                    .padding(.vertical, tokens.spacing.xl)

            case .error:
                reguertaCard {
                    VStack(alignment: .leading, spacing: tokens.spacing.md) {
                        Text("No se pudieron cargar los pedidos")
                            .font(tokens.typography.titleCard.weight(.semibold))
                            .foregroundStyle(tokens.colors.feedbackError)
                        Text("Revisa la conexión y vuelve a intentarlo.")
                            .font(tokens.typography.bodySecondary)
                            .foregroundStyle(tokens.colors.textSecondary)
                        reguertaButton("Reintentar") {
                            Task {
                                await viewModel.retry()
                            }
                        }
                    }
                }

            case .loaded(let snapshot):
                ReceivedOrdersSummaryContent(
                    tokens: tokens,
                    snapshot: snapshot,
                    selectedTab: viewModel.selectedTab,
                    updatingStatusOrderId: nil,
                    showsStatusActions: false,
                    onSelectStatus: { _, _ in }
                )
                .accessibilityIdentifier("receivedOrdersHistory.summaryContent")
            }
        }
    }

    @ViewBuilder
    private func infoCard(title: String, body: String) -> some View {
        reguertaCard {
            VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                Text(title)
                    .font(tokens.typography.titleCard.weight(.semibold))
                    .foregroundStyle(tokens.colors.textPrimary)
                Text(body)
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
            }
        }
    }
}
