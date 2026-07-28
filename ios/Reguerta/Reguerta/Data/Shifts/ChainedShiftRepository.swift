import Foundation

struct ChainedShiftRepository: ShiftRepository {
    let primary: any ShiftRepository
    let fallback: any ShiftRepository

    func allShifts() async throws -> [ShiftAssignment] {
        try await primary.allShifts()
    }

    func upsert(shift: ShiftAssignment) async throws -> ShiftAssignment {
        try await primary.upsert(shift: shift)
    }
}
