import Foundation

protocol ShiftRepository: Sendable {
    func allShifts(environment: SessionEnvironment) async throws -> [ShiftAssignment]
}
