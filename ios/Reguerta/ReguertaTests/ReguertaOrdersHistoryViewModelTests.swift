import Foundation
import Testing

@testable import Reguerta

@MainActor
struct ReguertaOrdersHistoryViewModelTests {
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
