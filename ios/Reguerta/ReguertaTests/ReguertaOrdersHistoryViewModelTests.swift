import Foundation
import Testing

@testable import Reguerta

@MainActor
struct ReguertaOrdersHistoryViewModelTests {
    @Test
    func myOrdersHistoryPresentationUsesTheActiveEnglishLocale() throws {
        let option = try #require(
            orderHistoryWeekOption(
                weekKey: "2026-W27",
                locale: Locale(identifier: "en_US")
            )
        )
        let presentation = orderHistoryWeekPresentation(
            option,
            locale: Locale(identifier: "en_US"),
            weekLabel: "Week",
            shortWeekLabel: "Wk",
            orderLabel: "Order"
        )

        #expect(presentation.rangeLabel == "Jun 29 - Jul 5")
        #expect(presentation.title == "2026 Week 27")
        #expect(presentation.pickerLabel == "Jun 29 - Jul 5 · 2026 Wk 27")
        #expect(presentation.orderTitle == "Order Jun 29 - Jul 5")
    }

    @Test
    func myOrdersHistoryPresentationLocalizesGenericUnitLabelsOnly() {
        #expect(
            localizedGenericOrderHistoryQuantityLabel(
                "1 ud.",
                singleLabel: "1 unit",
                pluralFormat: "%lld units"
            ) == "1 unit"
        )
        #expect(
            localizedGenericOrderHistoryQuantityLabel(
                "3 uds.",
                singleLabel: "1 unit",
                pluralFormat: "%lld units"
            ) == "3 units"
        )
        #expect(
            localizedGenericOrderHistoryQuantityLabel(
                "1 kg",
                singleLabel: "1 unit",
                pluralFormat: "%lld units"
            ) == "1 kg"
        )
    }

    @Test
    func myOrdersHistorySelectsPreviousIsoWeekAndFormatsHeader() async {
        let repository = InMemoryOrdersRepository()
        await repository.setOrderHistoryWeekKeys(["2026-W21"], forMemberId: "member_1")
        await repository.setPreviousOrder(previousOrderSnapshot(weekKey: "2026-W21"), forWeekKey: "2026-W21")
        let viewModel = makeMyOrdersHistoryViewModel(repository: repository)

        await viewModel.appear(
            context: myOrdersHistoryContext(nowMillis: testMillis(year: 2026, month: 5, day: 25))
        )

        #expect(viewModel.selectedWeekKey == "2026-W21")
        #expect(viewModel.selectedWeek?.orderTitle == "Pedido 18 may - 24 may")
        #expect(viewModel.selectedWeek?.title == "2026 Semana 21")
        guard case .loaded(let snapshot) = viewModel.loadState else {
            Issue.record("Expected previous ISO week order to load")
            return
        }
        #expect(snapshot.weekKey == "2026-W21")
    }

    @Test
    func myOrdersHistoryBuildsContinuousPickerWeeksAndShowsIntermediateEmptyWeek() async {
        let repository = InMemoryOrdersRepository()
        await repository.setOrderHistoryWeekKeys(["2026-W19", "2026-W21"], forMemberId: "member_1")
        await repository.setPreviousOrder(previousOrderSnapshot(weekKey: "2026-W19"), forWeekKey: "2026-W19")
        await repository.setPreviousOrder(previousOrderSnapshot(weekKey: "2026-W21"), forWeekKey: "2026-W21")
        let viewModel = makeMyOrdersHistoryViewModel(repository: repository)

        await viewModel.appear(
            context: myOrdersHistoryContext(nowMillis: testMillis(year: 2026, month: 5, day: 18))
        )

        #expect(viewModel.availableWeeks.map(\.weekKey) == ["2026-W19", "2026-W20", "2026-W21"])
        #expect(viewModel.selectedWeekKey == "2026-W20")
        #expect(viewModel.selectedWeek?.pickerLabel == "11 may - 17 may · 2026 Sem 20")
        #expect(viewModel.canGoPrevious)
        #expect(viewModel.canGoNext)
        #expect(viewModel.loadState == .empty)

        await viewModel.selectPreviousWeek()
        #expect(viewModel.selectedWeekKey == "2026-W19")
        #expect(!viewModel.canGoPrevious)
        guard case .loaded(let snapshot) = viewModel.loadState else {
            Issue.record("Expected first bounded order to load")
            return
        }
        #expect(snapshot.weekKey == "2026-W19")
    }

    @Test
    func myOrdersHistoryRetryKeepsSelectedWeek() async {
        let repository = InMemoryOrdersRepository()
        await repository.setOrderHistoryWeekKeys(["2026-W21"], forMemberId: "member_1")
        let viewModel = makeMyOrdersHistoryViewModel(repository: repository)

        await viewModel.appear(
            context: myOrdersHistoryContext(nowMillis: testMillis(year: 2026, month: 5, day: 25))
        )
        await repository.setPreviousOrderError(InMemoryOrdersRepositoryError.forcedFailure)
        await viewModel.retry()

        #expect(viewModel.selectedWeekKey == "2026-W21")
        #expect(viewModel.loadState == .error)
    }
}
