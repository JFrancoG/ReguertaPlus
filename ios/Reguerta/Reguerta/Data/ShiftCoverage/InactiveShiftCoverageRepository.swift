/// Preview and unrelated UI journeys keep the capability closed without constructing live infrastructure.
struct InactiveShiftCoverageRepository: ShiftCoverageRepository {
    func read(caseId: String?, session: ShiftCoverageSession) async throws -> ShiftCoverageSnapshot {
        throw ShiftCoverageFailure.unavailable
    }

    func execute(_ command: ShiftCoverageCommand, session: ShiftCoverageSession) async throws {
        throw ShiftCoverageFailure.unavailable
    }
}
