import Foundation

protocol ShiftRepository: Sendable {
    func allShifts() async -> [ShiftAssignment]
}
