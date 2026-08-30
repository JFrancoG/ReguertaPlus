import Foundation

actor InMemoryShiftRepository: ShiftRepository {
    private let items: [String: ShiftAssignment]

    init(items: [ShiftAssignment] = []) {
        self.items = Dictionary(uniqueKeysWithValues: items.map { ($0.id, $0) })
    }

    func allShifts(environment _: SessionEnvironment) async -> [ShiftAssignment] {
        items.values.sorted { $0.dateMillis < $1.dateMillis }
    }
}
