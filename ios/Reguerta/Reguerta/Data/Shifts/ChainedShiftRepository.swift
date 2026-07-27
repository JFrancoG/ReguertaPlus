import Foundation

struct ChainedShiftRepository: ShiftRepository {
    let primary: any ShiftRepository
    let fallback: any ShiftRepository

    func allShifts() async -> [ShiftAssignment] {
        let primaryResult = await primary.allShifts()
        return primaryResult.isEmpty ? await fallback.allShifts() : primaryResult
    }

    func upsert(shift: ShiftAssignment) async throws -> ShiftAssignment {
        try await primary.upsert(shift: shift)
    }
}
