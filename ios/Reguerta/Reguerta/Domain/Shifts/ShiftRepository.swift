import Foundation

protocol ShiftRepository: Sendable {
    func allShifts() async throws -> [ShiftAssignment]
    func upsert(shift: ShiftAssignment) async throws -> ShiftAssignment
}
