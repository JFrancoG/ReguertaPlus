import Foundation

protocol ShiftRepository: Sendable {
    func allShifts() async -> [ShiftAssignment]
    func upsert(shift: ShiftAssignment) async -> ShiftAssignment
}
