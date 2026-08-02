import Foundation

struct ChainedShiftRepository<Primary: ShiftRepository, Fallback: ShiftRepository>: ShiftRepository {
    let primary: Primary
    let fallback: Fallback

    func allShifts() async throws -> [ShiftAssignment] {
        try await primary.allShifts()
    }

    func upsert(shift: ShiftAssignment) async throws -> ShiftAssignment {
        try await primary.upsert(shift: shift)
    }
}
