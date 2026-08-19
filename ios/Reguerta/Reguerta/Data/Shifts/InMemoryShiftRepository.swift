import Foundation

actor InMemoryShiftRepository: ShiftRepository {
    private var items: [String: ShiftAssignment]

    init(items: [ShiftAssignment] = []) {
        self.items = Dictionary(uniqueKeysWithValues: items.map { ($0.id, $0) })
    }

    func allShifts(environment _: SessionEnvironment) async -> [ShiftAssignment] {
        items.values.sorted { $0.dateMillis < $1.dateMillis }
    }

    func upsert(shift: ShiftAssignment, environment _: SessionEnvironment) async -> ShiftAssignment {
        items[shift.id] = shift
        return shift
    }
}
