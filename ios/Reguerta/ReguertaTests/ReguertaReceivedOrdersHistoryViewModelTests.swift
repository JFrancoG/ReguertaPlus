import Foundation
import Testing

@testable import Reguerta

@MainActor
struct ReguertaReceivedOrdersHistoryViewModelTests {
    @Test
    func receivedOrdersHistoryPresentationUsesTheActiveEnglishLocale() throws {
        let option = try #require(
            orderHistoryWeekOption(
                weekKey: "2026-W27",
                locale: Locale(identifier: "en")
            )
        )
        let presentation = orderHistoryWeekPresentation(
            option,
            locale: Locale(identifier: "en"),
            weekLabel: "Week",
            shortWeekLabel: "Wk",
            orderLabel: "Received orders"
        )

        #expect(presentation.title == "2026 Week 27")
        #expect(presentation.pickerLabel == "Jun 29 - Jul 5 · 2026 Wk 27")
        #expect(presentation.orderTitle == "Received orders Jun 29 - Jul 5")
    }

    @Test
    func receivedOrdersHistorySelectsPreviousIsoWeekAndFormatsTitle() async {
        let repository = InMemoryOrdersRepository()
        await repository.setReceivedOrdersHistoryWeekKeys(["2026-W21"], forProducerId: "producer_even")
        await repository.setReceivedOrdersSnapshot(
            receivedOrdersSnapshot(status: .read),
            producerId: "producer_even",
            weekKey: "2026-W21"
        )
        let viewModel = makeReceivedOrdersHistoryViewModel(repository: repository)

        await viewModel.appear(
            context: receivedOrdersHistoryContext(nowMillis: testMillis(year: 2026, month: 5, day: 25))
        )

        #expect(viewModel.selectedWeekKey == "2026-W21")
        #expect(viewModel.selectedTitle == "Pedidos recibidos 18 may - 24 may")
        #expect(viewModel.selectedWeek?.title == "2026 Semana 21")
        #expect(viewModel.selectedWeek?.pickerLabel == "18 may - 24 may · 2026 Sem 21")
        guard case .loaded(let snapshot) = viewModel.loadState else {
            Issue.record("Expected received orders history to load")
            return
        }
        #expect(snapshot.byProductRows.first?.productName == "Tomates")
    }

    @Test
    func receivedOrdersHistoryBuildsContinuousRangeAndShowsIntermediateEmptyWeek() async {
        let repository = InMemoryOrdersRepository()
        await repository.setReceivedOrdersHistoryWeekKeys(["2026-W19", "2026-W21"], forProducerId: "producer_even")
        await repository.setReceivedOrdersSnapshot(
            receivedOrdersSnapshot(status: .read),
            producerId: "producer_even",
            weekKey: "2026-W19"
        )
        await repository.setReceivedOrdersSnapshot(
            receivedOrdersSnapshot(status: .prepared),
            producerId: "producer_even",
            weekKey: "2026-W21"
        )
        let viewModel = makeReceivedOrdersHistoryViewModel(repository: repository)

        await viewModel.appear(
            context: receivedOrdersHistoryContext(nowMillis: testMillis(year: 2026, month: 5, day: 18))
        )

        #expect(viewModel.availableWeeks.map(\.weekKey) == ["2026-W19", "2026-W20", "2026-W21"])
        #expect(viewModel.selectedWeekKey == "2026-W20")
        #expect(viewModel.canGoPrevious)
        #expect(viewModel.canGoNext)
        #expect(viewModel.loadState == .empty)

        await viewModel.selectPreviousWeek()
        #expect(viewModel.selectedWeekKey == "2026-W19")
        #expect(!viewModel.canGoPrevious)
        guard case .loaded(let firstSnapshot) = viewModel.loadState else {
            Issue.record("Expected first bounded received order to load")
            return
        }
        #expect(firstSnapshot.byMemberGroups.first?.producerStatus == .read)

        await viewModel.selectNextWeek()
        await viewModel.selectNextWeek()
        #expect(viewModel.selectedWeekKey == "2026-W21")
        #expect(!viewModel.canGoNext)
    }

    @Test
    func receivedOrdersHistoryUsesOldestGlobalOrderWhenProducerHasNoOrders() async {
        let repository = InMemoryOrdersRepository()
        await repository.setOldestOrderHistoryWeekKey("2025-W01")
        let viewModel = makeReceivedOrdersHistoryViewModel(repository: repository)

        await viewModel.appear(
            context: receivedOrdersHistoryContext(nowMillis: testMillis(year: 2026, month: 7, day: 11))
        )

        #expect(viewModel.availableWeeks.first?.weekKey == "2025-W01")
        #expect(viewModel.availableWeeks.last?.weekKey == "2026-W27")
        #expect(viewModel.selectedWeekKey == "2026-W27")
        #expect(viewModel.canGoPrevious)
        #expect(!viewModel.canGoNext)
        #expect(viewModel.loadState == .empty)

        await viewModel.selectPreviousWeek()
        #expect(viewModel.selectedWeekKey == "2026-W26")
        #expect(viewModel.loadState == .empty)

        await repository.setOldestOrderHistoryWeekKey("2026-W01")
        await viewModel.loadHistoryIfNeeded(force: true)
        #expect(viewModel.availableWeeks.first?.weekKey == "2026-W01")
        #expect(viewModel.availableWeeks.last?.weekKey == "2026-W27")
    }

    @Test
    func receivedOrdersHistoryRetryKeepsSelectedWeekAndDoesNotWriteStatus() async {
        let repository = InMemoryOrdersRepository()
        await repository.setReceivedOrdersHistoryWeekKeys(["2026-W21"], forProducerId: "producer_even")
        await repository.setReceivedOrdersSnapshot(
            receivedOrdersSnapshot(status: .unread),
            producerId: "producer_even",
            weekKey: "2026-W21"
        )
        let viewModel = makeReceivedOrdersHistoryViewModel(repository: repository)

        await viewModel.appear(
            context: receivedOrdersHistoryContext(nowMillis: testMillis(year: 2026, month: 5, day: 25))
        )
        await repository.setReceivedOrdersError(InMemoryOrdersRepositoryError.forcedFailure)
        await viewModel.retry()

        #expect(viewModel.selectedWeekKey == "2026-W21")
        #expect(viewModel.loadState == .error)
        #expect(await repository.receivedStatusUpdates().isEmpty)
    }
}
