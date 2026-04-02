import Foundation

struct InMemoryShiftRepository: ShiftRepository {
    let items: [ShiftAssignment]

    init(items: [ShiftAssignment] = []) {
        self.items = items
    }

    func allShifts() async -> [ShiftAssignment] {
        items.sorted { $0.dateMillis < $1.dateMillis }
    }
}
